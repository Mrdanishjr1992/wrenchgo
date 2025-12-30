import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentIntentRequest {
  jobId: string;
  quoteId: string;
  promotionCode?: string;
}

interface PaymentBreakdown {
  quoteAmountCents: number;
  customerPlatformFeeCents: number;
  customerDiscountCents: number;
  customerTotalCents: number;
  mechanicPlatformCommissionCents: number;
  mechanicPayoutCents: number;
  platformRevenueCents: number;
  promotionApplied?: {
    code: string;
    type: string;
    discountCents: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { jobId, quoteId, promotionCode }: PaymentIntentRequest = await req.json();

    if (!jobId || !quoteId) {
      throw new Error("Missing required fields: jobId, quoteId");
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*, jobs!inner(customer_id, mechanic_id, status)")
      .eq("id", quoteId)
      .eq("job_id", jobId)
      .single();

    if (quoteError || !quote) {
      throw new Error("Quote not found");
    }

    if (quote.jobs.customer_id !== user.id) {
      throw new Error("Unauthorized: You are not the customer for this job");
    }

    if (quote.jobs.status !== "accepted") {
      throw new Error("Quote must be accepted before payment");
    }

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("job_id", jobId)
      .eq("quote_id", quoteId)
      .in("status", ["paid", "processing"])
      .single();

    if (existingPayment) {
      throw new Error("Payment already exists for this job");
    }

    const quoteAmountCents = Math.round(quote.amount * 100);
    const customerPlatformFeeCents = 1500;
    let customerDiscountCents = 0;
    let promotionApplied: PaymentBreakdown["promotionApplied"];

    if (promotionCode) {
      const { data: promotion, error: promoError } = await supabase
        .from("promotions")
        .select("*")
        .eq("code", promotionCode.toUpperCase())
        .eq("active", true)
        .single();

      if (promotion && !promoError) {
        const now = new Date();
        const startDate = new Date(promotion.start_date);
        const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

        if (now >= startDate && (!endDate || now <= endDate)) {
          if (
            !promotion.max_redemptions ||
            promotion.current_redemptions < promotion.max_redemptions
          ) {
            const { data: userRedemptions } = await supabase
              .from("promotion_redemptions")
              .select("id")
              .eq("promotion_id", promotion.id)
              .eq("user_id", user.id);

            const userRedemptionCount = userRedemptions?.length || 0;

            if (userRedemptionCount < (promotion.max_redemptions_per_user || 1)) {
              if (
                !promotion.minimum_amount_cents ||
                quoteAmountCents >= promotion.minimum_amount_cents
              ) {
                if (promotion.type === "percent_discount" && promotion.percent_off) {
                  customerDiscountCents = Math.round(
                    (quoteAmountCents + customerPlatformFeeCents) * (promotion.percent_off / 100)
                  );
                } else if (promotion.type === "fixed_discount" && promotion.amount_cents) {
                  customerDiscountCents = promotion.amount_cents;
                } else if (promotion.type === "waive_platform_fee") {
                  customerDiscountCents = customerPlatformFeeCents;
                }

                promotionApplied = {
                  code: promotion.code,
                  type: promotion.type,
                  discountCents: customerDiscountCents,
                };
              }
            }
          }
        }
      }
    }

    const customerTotalCents = Math.max(
      0,
      quoteAmountCents + customerPlatformFeeCents - customerDiscountCents
    );

    const mechanicPlatformCommissionCents = Math.min(
      Math.round(quoteAmountCents * 0.12),
      5000
    );
    const mechanicPayoutCents = quoteAmountCents - mechanicPlatformCommissionCents;
    const platformRevenueCents =
      customerPlatformFeeCents + mechanicPlatformCommissionCents - customerDiscountCents;

    const { data: mechanicStripeAccount } = await supabase
      .from("mechanic_stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("mechanic_id", quote.jobs.mechanic_id)
      .single();

    if (!mechanicStripeAccount || !mechanicStripeAccount.charges_enabled) {
      throw new Error("Mechanic has not completed Stripe onboarding");
    }

    const idempotencyKey = `payment_${jobId}_${quoteId}_${Date.now()}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: customerTotalCents,
        currency: "usd",
        application_fee_amount: platformRevenueCents,
        transfer_data: {
          destination: mechanicStripeAccount.stripe_account_id,
        },
        metadata: {
          job_id: jobId,
          quote_id: quoteId,
          customer_id: user.id,
          mechanic_id: quote.jobs.mechanic_id,
          promotion_code: promotionCode || "",
        },
        description: `WrenchGo Job Payment - Job ${jobId}`,
      },
      {
        idempotencyKey,
      }
    );

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        job_id: jobId,
        quote_id: quoteId,
        customer_id: user.id,
        mechanic_id: quote.jobs.mechanic_id,
        quote_amount_cents: quoteAmountCents,
        customer_platform_fee_cents: customerPlatformFeeCents,
        customer_discount_cents: customerDiscountCents,
        customer_total_cents: customerTotalCents,
        mechanic_platform_commission_cents: mechanicPlatformCommissionCents,
        mechanic_discount_cents: 0,
        mechanic_payout_cents: mechanicPayoutCents,
        platform_revenue_cents: platformRevenueCents,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_connected_account_id: mechanicStripeAccount.stripe_account_id,
        status: "processing",
        promotion_codes: promotionCode ? [promotionCode.toUpperCase()] : [],
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Failed to create payment record:", paymentError);
      throw new Error("Failed to create payment record");
    }

    if (promotionApplied) {
      await supabase.from("promotion_redemptions").insert({
        promotion_id: promotionApplied.code,
        user_id: user.id,
        job_id: jobId,
        payment_id: payment.id,
        discount_amount_cents: customerDiscountCents,
      });
    }

    const breakdown: PaymentBreakdown = {
      quoteAmountCents,
      customerPlatformFeeCents,
      customerDiscountCents,
      customerTotalCents,
      mechanicPlatformCommissionCents,
      mechanicPayoutCents,
      platformRevenueCents,
      promotionApplied,
    };

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        breakdown,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
