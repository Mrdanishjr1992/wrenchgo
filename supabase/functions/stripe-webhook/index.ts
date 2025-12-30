import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentCanceled(supabase, paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, charge);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function handlePaymentIntentSucceeded(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`Payment succeeded: ${paymentIntent.id}`);

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (fetchError || !payment) {
    console.error("Payment record not found:", fetchError);
    return;
  }

  const charge = paymentIntent.charges?.data[0];

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_charge_id: charge?.id,
      payment_method_type: paymentIntent.payment_method_types?.[0],
      receipt_url: charge?.receipt_url,
    })
    .eq("id", payment.id);

  if (updateError) {
    console.error("Failed to update payment:", updateError);
    return;
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.job_id);

  if (jobError) {
    console.error("Failed to update job status:", jobError);
  }

  console.log(`Payment ${payment.id} marked as paid`);
}

async function handlePaymentIntentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`Payment failed: ${paymentIntent.id}`);

  const { error } = await supabase
    .from("payments")
    .update({
      status: "failed",
      failure_reason: paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  if (error) {
    console.error("Failed to update payment:", error);
  }
}

async function handlePaymentIntentCanceled(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`Payment canceled: ${paymentIntent.id}`);

  const { error } = await supabase
    .from("payments")
    .update({
      status: "cancelled",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  if (error) {
    console.error("Failed to update payment:", error);
  }
}

async function handleChargeRefunded(supabase: any, charge: Stripe.Charge) {
  console.log(`Charge refunded: ${charge.id}`);

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (fetchError || !payment) {
    console.error("Payment record not found:", fetchError);
    return;
  }

  const refundAmount = charge.amount_refunded;
  const isFullRefund = refundAmount === charge.amount;

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: isFullRefund ? "refunded" : "partially_refunded",
      refund_amount_cents: refundAmount,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateError) {
    console.error("Failed to update payment:", updateError);
    return;
  }

  if (isFullRefund) {
    const { error: jobError } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.job_id);

    if (jobError) {
      console.error("Failed to update job status:", jobError);
    }
  }

  console.log(`Payment ${payment.id} marked as ${isFullRefund ? "refunded" : "partially_refunded"}`);
}

async function handleAccountUpdated(supabase: any, account: Stripe.Account) {
  console.log(`Account updated: ${account.id}`);

  const { error } = await supabase
    .from("mechanic_stripe_accounts")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      status: account.charges_enabled && account.payouts_enabled ? "active" : "pending",
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    console.error("Failed to update mechanic Stripe account:", error);
  }
}
