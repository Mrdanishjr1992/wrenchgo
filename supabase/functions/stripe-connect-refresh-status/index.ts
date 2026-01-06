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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Client for auth verification
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Admin client for database updates (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    const { data: payoutAccount } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
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

    console.log("Stripe account status:", {
      id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });

    // Update mechanic_stripe_accounts
    const { error: stripeAccountError } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .update({
        onboarding_complete: account.details_submitted || false,
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        updated_at: new Date().toISOString(),
      })
      .eq("mechanic_id", user.id);

    if (stripeAccountError) {
      console.error("Error updating mechanic_stripe_accounts:", stripeAccountError);
    }

    // Update mechanic_profiles
    const { error: profileError } = await supabaseAdmin
      .from("mechanic_profiles")
      .update({
        stripe_account_id: payoutAccount.stripe_account_id,
        stripe_onboarding_complete: account.details_submitted || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Error updating mechanic_profiles:", profileError);
    }

    console.log("Updated mechanic profile for user:", user.id);

    return new Response(
      JSON.stringify({
        stripeAccountId: account.id,
        onboardingComplete: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
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
