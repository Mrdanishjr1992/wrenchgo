// Supabase Edge Function: stripe-webhook
//
// This webhook is intentionally focused on keeping Supabase tables in sync with Stripe
// for the booking "escrow" payment flow:
// - PaymentIntents are created with capture_method='manual'
// - When a PaymentIntent becomes capturable (authorized), we mark payments.status='requires_capture'
// - When captured (succeeded), we mark payments.status='succeeded' and set paid_at
// - We also call authorize_contract_payment(...) when we can identify the contract
//
// NOTE: payout/transfer bookkeeping can be layered on top of this, but is intentionally
// kept out of this minimal, reliable webhook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

type Json = Record<string, unknown>;

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse(500, { error: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(400, { error: "Missing stripe-signature header" });
  }

  const bodyText = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, signature, stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return jsonResponse(400, { error: "Webhook signature verification failed" });
  }

  async function updatePaymentById(paymentId: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("payments").update(values).eq("id", paymentId);
    if (error) {
      console.error("Failed to update payment by id:", paymentId, error);
    }
  }

  async function updatePaymentByIntentId(intentId: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("payments").update(values).eq("stripe_payment_intent_id", intentId);
    if (error) {
      console.error("Failed to update payment by intent:", intentId, error);
    }
  }

  async function maybeAuthorizeContract(pi: Stripe.PaymentIntent) {
    const contractId = (pi.metadata?.contract_id as string | undefined) ?? undefined;
    if (!contractId) return;

    // Idempotent RPC (hardened in migrations).
    const { error } = await supabase.rpc("authorize_contract_payment", {
      p_contract_id: contractId,
      p_stripe_payment_intent_id: pi.id,
    });

    if (error) {
      console.error("authorize_contract_payment failed", { contractId, pi: pi.id, error });
    }
  }

  async function markContractCapturedIfPresent(pi: Stripe.PaymentIntent) {
    const contractId = (pi.metadata?.contract_id as string | undefined) ?? undefined;
    if (!contractId) return;

    // These columns are added in 20260204000004_payment_escrow_and_webhook_hardening.sql
    const { error } = await supabase
      .from("job_contracts")
      .update({
        payment_captured_at: nowIso(),
        payment_capture_required: false,
      })
      .eq("id", contractId)
      .is("payment_captured_at", null);

    if (error) {
      console.error("Failed to mark contract captured", { contractId, error });
    }
  }

  // -----------------
  // Event handling
  // -----------------
  try {
    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = (pi.metadata?.payment_id as string | undefined) ?? undefined;

        const updates = {
          status: "requires_capture",
          client_secret: pi.client_secret,
          error_message: null,
          updated_at: nowIso(),
        };

        if (paymentId) await updatePaymentById(paymentId, updates);
        await updatePaymentByIntentId(pi.id, updates);

        await maybeAuthorizeContract(pi);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = (pi.metadata?.payment_id as string | undefined) ?? undefined;

        const updates = {
          status: "succeeded",
          paid_at: nowIso(),
          client_secret: pi.client_secret,
          error_message: null,
          updated_at: nowIso(),
        };

        if (paymentId) await updatePaymentById(paymentId, updates);
        await updatePaymentByIntentId(pi.id, updates);

        await maybeAuthorizeContract(pi);
        await markContractCapturedIfPresent(pi);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = (pi.metadata?.payment_id as string | undefined) ?? undefined;
        const failureMessage = (pi.last_payment_error?.message as string | undefined) ?? "Payment failed";

        const updates = {
          status: "failed",
          error_message: failureMessage,
          client_secret: pi.client_secret,
          updated_at: nowIso(),
        };

        if (paymentId) await updatePaymentById(paymentId, updates);
        await updatePaymentByIntentId(pi.id, updates);
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = (pi.metadata?.payment_id as string | undefined) ?? undefined;

        const updates = {
          status: "cancelled",
          error_message: null,
          client_secret: pi.client_secret,
          updated_at: nowIso(),
        };

        if (paymentId) await updatePaymentById(paymentId, updates);
        await updatePaymentByIntentId(pi.id, updates);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!intentId) break;

        const updates = {
          status: "refunded",
          refunded_at: nowIso(),
          updated_at: nowIso(),
        };

        await updatePaymentByIntentId(intentId, updates);
        break;
      }

      default:
        // Ignore other event types.
        break;
    }

    return jsonResponse(200, { received: true });
  } catch (err) {
    console.error("Error handling Stripe webhook:", err);
    return jsonResponse(500, { error: "Webhook handler failed" });
  }
});
