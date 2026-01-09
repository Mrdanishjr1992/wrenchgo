import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeadersFor, json, requireEnv } from "../_shared/helpers.ts";



const headers = corsHeadersFor(req);


const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  const origin = getOrigin(req);
  const headers = corsHeaders(isAllowedOrigin(origin) ? origin : null);

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization" }, headers);

    const supabase = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const serviceSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json(401, { error: "Unauthorized" }, headers);

    const body = await req.json().catch(() => null);
    const job_id = body?.job_id;
    if (!job_id) return json(400, { error: "Missing job_id" }, headers);

    // Job
    const { data: job, error: jobError } = await supabase.from("jobs").select("*").eq("id", job_id).single();
    if (jobError || !job) return json(404, { error: "Job not found" }, headers);

    if (job.customer_id !== user.id) return json(403, { error: "Only customer can initiate payment" }, headers);
    if (job.status !== "completed") return json(400, { error: "Job not completed yet" }, headers);
    if (!job.mechanic_verified_at || !job.customer_verified_at) return json(400, { error: "Both parties must verify completion" }, headers);

    // Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("job_invoices")
      .select("*")
      .eq("job_id", job_id)
      .single();

    if (invoiceError || !invoice) return json(404, { error: "Invoice not found" }, headers);
    if (invoice.status !== "locked") return json(400, { error: "Invoice not locked" }, headers);

    const originalTotalCents = Number(invoice.total_cents || 0);
    const mechanicNetCents = Number(invoice.mechanic_net_cents || 0);
    const originalPlatformFeeCents = Number(invoice.platform_fee_cents || 0);

    // Mechanic Stripe
    const { data: mechanicAccount, error: mechErr } = await supabase
      .from("mechanic_stripe_accounts")
      .select("*")
      .eq("mechanic_id", job.mechanic_id)
      .single();

    if (mechErr || !mechanicAccount) return json(400, { error: "Mechanic not onboarded to Stripe" }, headers);
    if (!mechanicAccount.onboarding_completed || !mechanicAccount.charges_enabled) {
      return json(400, { error: "Mechanic Stripe account not ready for payments" }, headers);
    }

    // Existing active payment (safe)
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("job_id", job_id)
      .in("status", ["pending", "processing", "requires_action", "succeeded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.stripe_payment_intent_id && existingPayment.stripe_payment_intent_id !== "pending_creation") {
      return json(200, {
        success: true,
        payment_id: existingPayment.id,
        client_secret: existingPayment.client_secret,
        amount_cents: existingPayment.amount_cents,
        status: existingPayment.status,
        already_exists: true,
      }, headers);
    }

    // Create payment row first (idempotency anchor)
    const { data: payment, error: insertErr } = await serviceSupabase
      .from("payments")
      .insert({
        job_id,
        invoice_id: invoice.id,
        customer_id: job.customer_id,
        mechanic_id: job.mechanic_id,
        stripe_payment_intent_id: "pending_creation",
        amount_cents: originalTotalCents,
        platform_fee_cents: originalPlatformFeeCents,
        status: "pending",
        client_secret: null,
        metadata: {
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: mechanicNetCents,
          original_platform_fee_cents: originalPlatformFeeCents,
          original_total_cents: originalTotalCents,
        },
      })
      .select()
      .single();

    if (insertErr || !payment) return json(500, { error: "Failed to create payment record" }, headers);

    // Promo (best effort)
    let discountCents = 0;
    let finalPlatformFeeCents = originalPlatformFeeCents;
    let promoCreditType: string | null = null;
    let promoApplicationId: string | null = null;

    if (originalPlatformFeeCents > 0) {
      const { data: promoResult } = await serviceSupabase.rpc("apply_promo_to_payment", {
        p_payment_id: payment.id,
        p_user_id: user.id,
      });

      if (promoResult?.applied) {
        discountCents = Number(promoResult.discount_cents || 0);
        finalPlatformFeeCents = Number(promoResult.fee_after_cents || 0);
        promoCreditType = promoResult.credit_type || null;
        promoApplicationId = promoResult.application_id || null;
      }
    }

    const finalTotalCents = originalTotalCents - discountCents;
    if (finalTotalCents < 50) return json(400, { error: "Payment amount too low (minimum $0.50)" }, headers);

    // Guard: fee math must hold for explicit fee+transfer
    if (finalPlatformFeeCents < 0) return json(400, { error: "Invalid platform fee after promo" }, headers);

    const transferAmount = mechanicNetCents;

    if (finalTotalCents < transferAmount) {
      return json(400, { error: "Discount exceeds platform portion; final total < mechanic net" }, headers);
    }

    // If you want explicit fee control, enforce total = transfer + fee
    if (finalTotalCents !== transferAmount + finalPlatformFeeCents) {
      return json(400, { error: "Invoice mismatch: total != mechanic_net + platform_fee" }, headers);
    }

    // Add Stripe customer if you have it
    const { data: prof } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    const idempotencyKey = `pi_${payment.id}_completion_v1`;

    const pi = await stripe.paymentIntents.create({
      amount: finalTotalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },

      customer: prof?.stripe_customer_id || undefined,

      transfer_data: {
        destination: mechanicAccount.stripe_account_id,
        amount: transferAmount,
      },
      application_fee_amount: finalPlatformFeeCents,

      metadata: {
        job_id,
        invoice_id: invoice.id,
        payment_id: payment.id,
        customer_id: job.customer_id,
        mechanic_id: job.mechanic_id,
        mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
        total_cents: String(finalTotalCents),
        transfer_cents: String(transferAmount),
        platform_fee_cents: String(finalPlatformFeeCents),
        discount_cents: String(discountCents),
        promo_credit_type: promoCreditType || "",
      },

      description: `WrenchGo Job #${String(job_id).slice(0, 8)}: ${job.title}`,
    }, { idempotencyKey });

    // Persist PI details
    await serviceSupabase.from("payments").update({
      stripe_payment_intent_id: pi.id,
      amount_cents: finalTotalCents,
      platform_fee_cents: finalPlatformFeeCents,
      client_secret: pi.client_secret,
      metadata: {
        mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
        mechanic_net_cents: mechanicNetCents,
        transfer_amount_cents: transferAmount,
        original_platform_fee_cents: originalPlatformFeeCents,
        original_total_cents: originalTotalCents,
        discount_cents: discountCents,
        promo_application_id: promoApplicationId,
        promo_credit_type: promoCreditType,
      },
    }).eq("id", payment.id);

    return json(200, {
      success: true,
      payment_id: payment.id,
      payment_intent_id: pi.id,
      client_secret: pi.client_secret,
      amount_cents: finalTotalCents,
      original_amount_cents: originalTotalCents,
      discount_cents: discountCents,
      promo_applied: discountCents > 0,
      promo_credit_type: promoCreditType,
    }, headers);

  } catch (e) {
    console.error("[PI] ERROR:", e?.message || e);
    return json(500, { error: e?.message || "Internal server error" }, headers);
  }
});
