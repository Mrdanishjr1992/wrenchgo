import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payoutAccount } = await supabaseClient
      .from("mechanic_payout_accounts")
      .select("stripe_account_id")
      .eq("mechanic_id", user.id)
      .maybeSingle();

    if (!payoutAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe account found. Please complete onboarding first." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const account = await stripe.accounts.retrieve(payoutAccount.stripe_account_id);

    const onboardingStatus = account.details_submitted
      ? "complete"
      : account.requirements?.disabled_reason
      ? "restricted"
      : account.requirements?.currently_due && account.requirements.currently_due.length > 0
      ? "pending"
      : "incomplete";

    await supabaseClient
      .from("mechanic_payout_accounts")
      .update({
        onboarding_status: onboardingStatus,
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        requirements_due: account.requirements?.currently_due || [],
        updated_at: new Date().toISOString(),
      })
      .eq("mechanic_id", user.id);

    return new Response(
      JSON.stringify({
        stripeAccountId: account.id,
        onboardingStatus,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsDue: account.requirements?.currently_due || [],
        detailsSubmitted: account.details_submitted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
