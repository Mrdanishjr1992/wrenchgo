import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";

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
    console.log("=== Stripe Connect Account Link Request ===");

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      console.error("No Authorization header provided");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify the user's JWT token
    console.log("Verifying user token...");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log("User result:", { user: !!user, error: userError?.message });

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: userError?.message || "No user found"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { data: existingAccount } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .select("stripe_account_id, status")
      .eq("mechanic_id", user.id)
      .maybeSingle();

    let stripeAccountId = existingAccount?.stripe_account_id;

    if (!stripeAccountId) {
      console.log("Creating new Stripe account for mechanic:", user.id);
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          mechanic_id: user.id,
        },
      });

      stripeAccountId = account.id;
      console.log("Created Stripe account:", stripeAccountId);

      await supabaseAdmin.from("mechanic_stripe_accounts").insert({
        mechanic_id: user.id,
        stripe_account_id: stripeAccountId,
        status: "pending",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    } else {
      console.log("Using existing Stripe account:", stripeAccountId);
    }

    // Stripe requires HTTPS URLs, not deep links
    // We'll use a web redirect that then opens the app
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const returnUrl = `${supabaseUrl}/functions/v1/stripe-connect-return`;
    const refreshUrl = `${supabaseUrl}/functions/v1/stripe-connect-refresh`;

    console.log("Return URL:", returnUrl);
    console.log("Refresh URL:", refreshUrl);

    console.log("Creating account link...");
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    console.log("Retrieving account data...");
    const accountData = await stripe.accounts.retrieve(stripeAccountId);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    console.log("Updating mechanic_stripe_accounts...");
    await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .update({
        status: accountData.details_submitted
          ? accountData.charges_enabled && accountData.payouts_enabled
            ? "active"
            : "pending"
          : "pending",
        charges_enabled: accountData.charges_enabled || false,
        payouts_enabled: accountData.payouts_enabled || false,
        details_submitted: accountData.details_submitted || false,
        onboarding_url: accountLink.url,
        onboarding_expires_at: expiresAt.toISOString(),
      })
      .eq("mechanic_id", user.id);

    console.log("Success! Returning account link");

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        accountId: stripeAccountId,
        status: accountData.details_submitted
          ? accountData.charges_enabled && accountData.payouts_enabled
            ? "active"
            : "pending"
          : "pending",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating account link:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to create account link",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
