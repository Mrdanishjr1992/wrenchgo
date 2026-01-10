// supabase/functions/create-booking-payment/index.ts
//
// BOOKING PAYMENT (Commit -> Charge saved card)
// - Customer already saved a card (SetupIntent flow)
// - Customer commits to paying for booking
// - Server attempts OFF-SESSION charge immediately using default saved card
// - If SCA required, returns client_secret for client to authenticate
//
// Notes:
// - This version is launch-safe: stable idempotency, prevents obvious dupes,
//   does not trust client amount, and uses webhook as source-of-truth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeadersFor, json, requireEnv } from "../_shared/helpers.ts";

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  const headers = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    // ----------------------------
    // Auth
    // ----------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization" }, headers);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, serviceKey);
    const serviceSupabase = supabase;

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json(401, { error: "Unauthorized" }, headers);

    // ----------------------------
    // Validate request
    // ----------------------------
    const body = await req.json().catch(() => null);
    const job_id = body?.job_id;
    const quote_id = body?.quote_id;

    if (!job_id || !quote_id) {
      return json(400, { error: "Missing job_id or quote_id" }, headers);
    }

    // ----------------------------
    // Load job (must belong to customer)
    // ----------------------------
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) return json(404, { error: "Job not found" }, headers);

    if (job.customer_id !== user.id) {
      return json(403, { error: "Only customer can initiate booking payment" }, headers);
    }

    // Optional: basic state guard (don’t allow paying again after paid/cancelled)
    if (["paid", "cancelled", "canceled", "refunded"].includes(String(job.status || "").toLowerCase())) {
      return json(400, { error: `Job status does not allow booking payment (${job.status})` }, headers);
    }

    // ----------------------------
    // Load quote (must match job)
    // ----------------------------
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("job_id", job_id)
      .single();

    if (quoteError || !quote) {
      return json(
        404,
        { error: "Quote not found", quote_id, job_id, db_error: quoteError?.message },
        headers
      );
    }

    const amount = Number(quote.price_cents || 0);
    if (!Number.isFinite(amount) || amount < 50) {
      return json(400, { error: "Invalid booking amount (minimum $0.50)" }, headers);
    }

    // ----------------------------
    // Load customer Stripe customer id
    // ----------------------------
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) return json(404, { error: "Profile not found" }, headers);

    const stripeCustomerId = profile.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      return json(400, { error: "Customer has no saved card profile. Ask them to add a card first." }, headers);
    }

    // ----------------------------
    // Load default payment method (DB is source of truth for default)
    // ----------------------------
    const { data: defaultPm, error: pmErr } = await supabase
      .from("customer_payment_methods")
      .select("stripe_payment_method_id")
      .eq("customer_id", profile.id)
      .eq("is_default", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pmErr) console.error("[BOOKING] default PM lookup error:", pmErr.message);

    if (!defaultPm?.stripe_payment_method_id) {
      return json(400, { error: "No default payment method found. Ask user to add a card." }, headers);
    }

    // ----------------------------
    // Idempotency: if there is an existing active booking payment for job+quote, return it
    // We filter on JSON metadata using PostgREST filter syntax.
    // ----------------------------
    const { data: existingPayment, error: existingErr } = await supabase
      .from("payments")
      .select("*")
      .eq("job_id", job_id)
      .in("status", ["pending", "processing", "requires_action", "succeeded"])
      .filter("metadata->>type", "eq", "booking_payment")
      .filter("metadata->>quote_id", "eq", String(quote_id))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) console.error("[BOOKING] existing payment lookup error:", existingErr.message);

    if (existingPayment?.stripe_payment_intent_id && existingPayment.client_secret) {
      return json(
        200,
        {
          success: true,
          already_exists: true,
          payment_id: existingPayment.id,
          payment_intent_id: existingPayment.stripe_payment_intent_id,
          client_secret: existingPayment.client_secret,
          status: existingPayment.status,
          amount_cents: existingPayment.amount_cents,
        },
        headers
      );
    }

    // ----------------------------
    // Create payment DB record first (anchor for Stripe idempotency)
    // ----------------------------
    const { data: payment, error: insertErr } = await serviceSupabase
      .from("payments")
      .insert({
        job_id,
        customer_id: job.customer_id,
        mechanic_id: quote.mechanic_id,
        stripe_payment_intent_id: "pending_creation",
        amount_cents: amount,
        platform_fee_cents: 0,
        status: "pending",
        client_secret: null,
        metadata: {
          quote_id: String(quote_id),
          type: "booking_payment",
        },
      })
      .select()
      .single();

    if (insertErr || !payment) {
      console.error("[BOOKING] payment insert error:", insertErr?.message);
      return json(500, { error: "Failed to create payment record" }, headers);
    }

    // ----------------------------
    // Create PaymentIntent (OFF-SESSION, CONFIRM TRUE)
    // - If SCA required, Stripe throws; we capture the PI from err.raw.payment_intent
    // ----------------------------
    const idempotencyKey = `booking_${payment.id}_v1`;

    let pi: Stripe.PaymentIntent;

    try {
      pi = await stripe.paymentIntents.create(
        {
          amount,
          currency: "usd",
          customer: stripeCustomerId,
          payment_method: defaultPm.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          automatic_payment_methods: { enabled: true },

          metadata: {
            type: "booking_payment",
            job_id: String(job_id),
            quote_id: String(quote_id),
            payment_id: String(payment.id),
            customer_id: String(job.customer_id),
            mechanic_id: String(quote.mechanic_id),
          },

          description: `WrenchGo Booking: ${job.title}`,
        },
        { idempotencyKey }
      );
    } catch (err: any) {
      // Off-session SCA errors often include a payment_intent object
      const piFromErr = err?.raw?.payment_intent as Stripe.PaymentIntent | undefined;
      if (piFromErr?.id && piFromErr?.client_secret) {
        pi = piFromErr;
      } else {
        console.error("[BOOKING] Stripe create error:", err?.message || err);
        // Mark payment as failed in DB
        await serviceSupabase
          .from("payments")
          .update({
            status: "failed",
            error_message: err?.raw?.message || err?.message || "Stripe error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        return json(500, { error: err?.raw?.message || err?.message || "Stripe error" }, headers);
      }
    }

    const mappedStatus =
      pi.status === "requires_action"
        ? "requires_action"
        : pi.status === "processing"
          ? "processing"
          : pi.status === "succeeded"
            ? "succeeded"
            : "pending";

    // Persist PI details
    await serviceSupabase
      .from("payments")
      .update({
        stripe_payment_intent_id: pi.id,
        client_secret: pi.client_secret,
        status: mappedStatus,
        updated_at: new Date().toISOString(),
        metadata: {
          quote_id: String(quote_id),
          type: "booking_payment",
        },
      })
      .eq("id", payment.id);

    return json(
      200,
      {
        success: true,
        payment_id: payment.id,
        payment_intent_id: pi.id,
        client_secret: pi.client_secret,
        status: pi.status,
        amount_cents: amount,
        requires_action: pi.status === "requires_action",
      },
      headers
    );
  } catch (e: any) {
    console.error("[BOOKING] ERROR:", e?.message || e);
    return json(500, { error: e?.message || "Internal server error" }, headers);
  }
});
