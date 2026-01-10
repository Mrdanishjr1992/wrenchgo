import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireEnv } from "../_shared/helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY")
);

const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sig = req.headers.get("stripe-signature");
  if (!sig) return json({ error: "Missing signature" }, 400);

  let event: Stripe.Event;
  let rawBody = "";

  try {
    rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e: any) {
    console.error("[WH] Signature verification failed:", e?.message || e);
    return json({ error: "Invalid signature" }, 400);
  }

  console.log(`[WH] ${event.type} ${event.id} account=${(event as any).account || ""}`);

  // Idempotency: record-first (requires UNIQUE(stripe_event_id))
  try {
    const { error: insertErr } = await supabase.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      metadata: { received_at: new Date().toISOString() },
    });

    if (insertErr) {
      const msg = insertErr.message || "";
      if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("23505")) {
        return json({ received: true, already_processed: true }, 200);
      }
      console.error("[WH] Failed to insert event row:", insertErr.message);
      // continue anyway (better to process than drop), but this may duplicate if Stripe retries
    }
  } catch (e) {
    console.error("[WH] Event insert exception:", e);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event.id);
        break;

      case "payment_intent.payment_failed":
        await onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.canceled":
        await onPaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.processing":
        await onPaymentIntentProcessing(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.updated":
        await onPaymentIntentUpdated(event.data.object as Stripe.PaymentIntent);
        break;

      case "setup_intent.succeeded":
        await onSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      case "setup_intent.setup_failed":
        // optional logging
        break;

      case "account.updated":
        await onAccountUpdated(event.data.object as Stripe.Account);
        break;

      case "charge.refunded":
        await onChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await onDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "transfer.created":
        await onTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case "transfer.failed":
        await onTransferFailed(event.data.object as Stripe.Transfer);
        break;

      case "payout.paid":
        await onPayoutPaid(event, event.data.object as Stripe.Payout);
        break;

      default:
        break;
    }

    await supabase
      .from("stripe_webhook_events")
      .update({
        metadata: { processed: true, processed_at: new Date().toISOString() },
      })
      .eq("stripe_event_id", event.id);

    return json({ received: true }, 200);
  } catch (e: any) {
    console.error(`[WH] Error processing ${event.id}:`, e?.message || e);

    await supabase
      .from("stripe_webhook_events")
      .update({
        metadata: {
          processed: false,
          error: e?.message || "unknown",
          attempted_at: new Date().toISOString(),
        },
      })
      .eq("stripe_event_id", event.id);

    return json({ error: e?.message || "Processing failed" }, 500);
  }
});

// -------------------- PaymentIntent handlers --------------------

async function onPaymentIntentUpdated(pi: Stripe.PaymentIntent) {
  if (pi.status !== "requires_action") return;

  await supabase
    .from("payments")
    .update({ status: "requires_action", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", pi.id);
}

async function onPaymentIntentProcessing(pi: Stripe.PaymentIntent) {
  await supabase
    .from("payments")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", pi.id);
}

async function onPaymentIntentFailed(pi: Stripe.PaymentIntent) {
  await supabase
    .from("payments")
    .update({
      status: "failed",
      error_message: pi.last_payment_error?.message || "Payment failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", pi.id);

  const { data: payment } = await supabase
    .from("payments")
    .select("customer_id, job_id")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();

  if (payment?.customer_id) {
    await supabase.from("notifications").insert({
      user_id: payment.customer_id,
      type: "payment_failed",
      title: "Payment Failed",
      body: pi.last_payment_error?.message || "Your payment could not be processed. Please try again.",
      data: { job_id: payment.job_id },
    });
  }
}

async function onPaymentIntentCanceled(pi: Stripe.PaymentIntent) {
  await supabase
    .from("payments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", pi.id);
}

async function onPaymentIntentSucceeded(pi: Stripe.PaymentIntent, eventId: string) {
  const meta = pi.metadata || {};
  const paymentIdFromMeta = meta.payment_id || null;
  const jobIdFromMeta = meta.job_id || null;
  const mechanicIdFromMeta = meta.mechanic_id || null;
  const mechanicStripeAccountId = meta.mechanic_stripe_account_id || null;

  let payment = null as any;

  const byPi = await supabase.from("payments").select("*").eq("stripe_payment_intent_id", pi.id).maybeSingle();
  if (byPi.data) payment = byPi.data;

  if (!payment && paymentIdFromMeta) {
    const byId = await supabase.from("payments").select("*").eq("id", paymentIdFromMeta).maybeSingle();
    if (byId.data) payment = byId.data;
  }

  if (!payment) {
    console.error("[WH:PI_SUCCESS] Payment not found for PI:", pi.id);
    return;
  }

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id || null;

  await supabase.from("payments").update({
    status: "succeeded",
    stripe_charge_id: chargeId,
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id);

  if (payment.invoice_id) {
    await supabase.from("job_invoices").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", payment.invoice_id);
  }

  const jobId = jobIdFromMeta || payment.job_id;
  if (jobId) {
    await supabase.from("jobs").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }

  const mechanicNetCents = Number(
    meta.transfer_cents || meta.mechanic_net_cents || payment?.metadata?.mechanic_net_cents || 0
  );
  const nextMonday = getNextMonday();

  await supabase.from("mechanic_ledger").upsert({
    mechanic_id: mechanicIdFromMeta || payment.mechanic_id,
    payment_id: payment.id,
    job_id: jobId,
    stripe_account_id: mechanicStripeAccountId,
    amount_cents: mechanicNetCents,
    status: "pending_transfer",
    available_for_transfer_at: nextMonday.toISOString(),
    transferred_at: new Date().toISOString(),
  }, { onConflict: "payment_id" });

  if (payment.customer_id && Number(payment.platform_fee_cents || 0) > 0) {
    await handleInvitationAward(payment.customer_id, payment.id, Number(payment.platform_fee_cents || 0), eventId);
  }

  const notifs: any[] = [];

  if (payment.customer_id) {
    notifs.push({
      user_id: payment.customer_id,
      type: "payment_succeeded",
      title: "Payment Successful",
      body: "Your payment has been processed successfully.",
      data: { job_id: jobId, payment_id: payment.id, charge_id: chargeId },
    });
  }

  if (payment.mechanic_id) {
    notifs.push({
      user_id: payment.mechanic_id,
      type: "payment_received",
      title: "Payment Received",
      body: `You received $${(mechanicNetCents / 100).toFixed(2)} for this job.`,
      data: { job_id: jobId, payment_id: payment.id, amount_cents: mechanicNetCents },
    });
  }

  if (notifs.length) await supabase.from("notifications").insert(notifs);
}

// -------------------- SetupIntent: save card (AUTHORITATIVE) --------------------

async function onSetupIntentSucceeded(si: Stripe.SetupIntent) {
  const customerId = si.customer as string | null;
  const paymentMethodId = si.payment_method as string | null;
  if (!customerId || !paymentMethodId) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!profile) return;

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.type !== "card" || !pm.card) return;

  await supabase.from("customer_payment_methods")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("customer_id", profile.id)
    .is("deleted_at", null);

  await supabase.from("customer_payment_methods").insert({
    customer_id: profile.id,
    stripe_customer_id: customerId,
    stripe_payment_method_id: paymentMethodId,
    card_brand: pm.card.brand,
    card_last4: pm.card.last4,
    card_exp_month: pm.card.exp_month,
    card_exp_year: pm.card.exp_year,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await supabase.from("profiles").update({
    payment_method_status: "active",
    updated_at: new Date().toISOString(),
  }).eq("id", profile.id);
}

// -------------------- Connect account updates --------------------

async function onAccountUpdated(acct: Stripe.Account) {
  await supabase.from("mechanic_stripe_accounts").update({
    // small fix: keep naming consistent with your other functions
    onboarding_complete: acct.details_submitted || false,
    charges_enabled: acct.charges_enabled || false,
    payouts_enabled: acct.payouts_enabled || false,
    details_submitted: acct.details_submitted || false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", acct.id);
}

// -------------------- Refunds / disputes --------------------

async function onChargeRefunded(charge: Stripe.Charge) {
  const { data: payment } = await supabase.from("payments").select("*").eq("stripe_charge_id", charge.id).maybeSingle();
  if (!payment) return;

  await supabase.from("payments").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", payment.id);

  if (payment.invoice_id) {
    await supabase.from("job_invoices").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", payment.invoice_id);
  }

  await supabase.from("mechanic_ledger").update({ status: "refunded" }).eq("payment_id", payment.id);

  await supabase.from("notifications").insert([
    {
      user_id: payment.customer_id,
      type: "refund_issued",
      title: "Refund Issued",
      body: "Your payment has been refunded.",
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
    {
      user_id: payment.mechanic_id,
      type: "refund_issued",
      title: "Payment Refunded",
      body: "A payment has been refunded and may be deducted from your balance.",
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
  ]);
}

async function onDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;

  const { data: payment } = await supabase.from("payments").select("*").eq("stripe_charge_id", chargeId).maybeSingle();
  if (!payment) return;

  await supabase.from("jobs").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", payment.job_id);
  if (payment.invoice_id) {
    await supabase.from("job_invoices").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", payment.invoice_id);
  }

  await supabase.from("notifications").insert([
    {
      user_id: payment.customer_id,
      type: "dispute_created",
      title: "Payment Dispute",
      body: "A dispute has been filed for this payment.",
      data: { job_id: payment.job_id, payment_id: payment.id, dispute_id: dispute.id },
    },
    {
      user_id: payment.mechanic_id,
      type: "dispute_created",
      title: "Payment Dispute",
      body: "A dispute has been filed. Funds may be held pending resolution.",
      data: { job_id: payment.job_id, payment_id: payment.id, dispute_id: dispute.id },
    },
  ]);
}

// -------------------- Transfers / payouts --------------------

async function onTransferCreated(transfer: Stripe.Transfer) {
  await supabase.from("transfers").upsert({
    stripe_transfer_id: transfer.id,
    status: "succeeded",
    amount_cents: transfer.amount,
    destination_account: transfer.destination as string,
    metadata: transfer.metadata,
  }, { onConflict: "stripe_transfer_id" });
}

async function onTransferFailed(transfer: Stripe.Transfer) {
  const { data: t } = await supabase.from("transfers").select("*").eq("stripe_transfer_id", transfer.id).maybeSingle();
  if (!t) return;
  await supabase.from("transfers").update({ status: "failed", error_message: "Transfer failed" }).eq("id", t.id);
}

async function onPayoutPaid(event: Stripe.Event, payout: Stripe.Payout) {
  const connectedAccountId = (event as any).account as string | undefined;
  if (!connectedAccountId) return;

  const { data: ledgerItems } = await supabase
    .from("mechanic_ledger")
    .select("*")
    .eq("stripe_account_id", connectedAccountId)
    .eq("status", "transferred")
    .is("paid_out_at", null);

  if (!ledgerItems?.length) return;

  await supabase.from("mechanic_ledger").update({
    status: "paid_out",
    stripe_payout_id: payout.id,
    paid_out_at: new Date((payout.arrival_date || 0) * 1000).toISOString(),
  }).in("id", ledgerItems.map((i: any) => i.id));

  const mechanicId = ledgerItems[0].mechanic_id;
  await supabase.from("notifications").insert({
    user_id: mechanicId,
    type: "payout_completed",
    title: "Payout Completed",
    body: `Your payout of $${(payout.amount / 100).toFixed(2)} has been sent.`,
    data: { payout_id: payout.id, amount_cents: payout.amount },
  });
}

// -------------------- Invitation promo (unchanged behavior) --------------------

async function handleInvitationAward(customerId: string, paymentId: string, platformFeeCents: number, stripeEventId: string) {
  if (platformFeeCents <= 0) return;

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, inviter_id")
    .eq("invited_id", customerId)
    .maybeSingle();

  if (!invitation) return;

  const { data: isFirst } = await supabase.rpc("check_first_qualifying_payment", {
    p_user_id: customerId,
    p_payment_id: paymentId,
  });

  if (!isFirst) return;

  const { data: awardResult, error: awardError } = await supabase.rpc("award_invitation_credits", {
    p_invited_id: customerId,
    p_payment_id: paymentId,
    p_stripe_event_id: stripeEventId,
  });

  if (awardError) return;

  if (awardResult?.success && awardResult?.inviter_id) {
    const awardType =
      awardResult.award_type === "FEELESS_1"
        ? "1 free platform fee credit"
        : awardResult.award_type === "FEELESS_3"
          ? "3 free platform fee credits"
          : "platform fee credits";


    await supabase.from("notifications").insert({
      user_id: awardResult.inviter_id,
      type: "invitation_reward",
      title: "Referral Reward Earned!",
      body: `Your friend completed their first job! You earned ${awardType}.`,
      data: { credit_type: awardResult.award_type },
    });
  }
}

function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}
