import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function getBearerToken(req: Request) {
  const raw =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("=== Stripe Connect Account Link Request ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      serviceRoleKeyPrefix: serviceRoleKey ? serviceRoleKey.substring(0, 10) : null,
      hasStripeKey: !!stripeKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required environment variables");
      return json(
        { error: "Server configuration error", details: "Missing Supabase credentials" },
        500
      );
    }

    if (!stripeKey) {
      console.error("Missing STRIPE_SECRET_KEY");
      return json(
        { error: "Server configuration error", details: "Missing Stripe credentials" },
        500
      );
    }

    const token = getBearerToken(req);
    console.log("Auth header present:", !!(req.headers.get("Authorization") || req.headers.get("authorization")));
    console.log("Token present:", !!token);

    if (!token) {
      console.error("No Bearer token provided");
      return json({ error: "No authorization header" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("Verifying user token...");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log("User result:", { user: !!user, error: userError?.message });

    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return json(
        {
          code: 401,
          message: "Invalid JWT",
          error: "Unauthorized",
          details: userError?.message || "No user found",
        },
        401
      );
    }

    console.log("User authenticated:", user.id);

    // Use RPC function to bypass RLS
    const { data: profileData, error: profileError } = await supabaseAdmin
      .rpc("get_profile_for_stripe", { p_user_id: user.id });

    const profile = profileData?.[0];
    console.log("Profile query result:", { profile: !!profile, error: profileError?.message });

    if (profileError || !profile) {
      console.error("Profile not found for user:", user.id, "Error:", profileError?.message);
      return json(
        { error: "Profile not found", details: profileError?.message || "No profile record exists" },
        404
      );
    }

    const { data: existingAccount, error: existingError } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .select("stripe_account_id")
      .eq("mechanic_id", user.id)
      .maybeSingle();

    console.log("Existing account query:", { hasAccount: !!existingAccount, error: existingError?.message });

    let stripeAccountId = existingAccount?.stripe_account_id;

    const now = new Date().toISOString();

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
        metadata: { mechanic_id: user.id },
      });

      stripeAccountId = account.id;
      console.log("Created Stripe account:", stripeAccountId);

      console.log("Inserting into mechanic_stripe_accounts...");
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from("mechanic_stripe_accounts")
        .insert({
          mechanic_id: user.id,
          stripe_account_id: stripeAccountId,
          onboarding_complete: false,
          charges_enabled: false,
          payouts_enabled: false,
        })
        .select();

      console.log("Insert result:", {
        inserted: !!insertData?.length,
        error: insertError?.message,
        code: insertError?.code,
      });

      if (insertError) {
        console.error("Error inserting mechanic_stripe_accounts:", insertError);
        throw new Error(`Failed to save Stripe account: ${insertError.message}`);
      }

      // Also update mechanic_profiles with the stripe_account_id
      const { error: updateError } = await supabaseAdmin
        .from("mechanic_profiles")
        .update({ stripe_account_id: stripeAccountId, updated_at: now })
        .eq("id", user.id);

      if (updateError) console.error("Error updating mechanic_profiles:", updateError);
    } else {
      console.log("Using existing Stripe account:", stripeAccountId);

      // Ensure mechanic_profiles has the stripe_account_id (in case it was missed before)
      const { error: updateError } = await supabaseAdmin
        .from("mechanic_profiles")
        .update({ stripe_account_id: stripeAccountId, updated_at: now })
        .eq("id", user.id);

      if (updateError) console.error("Error updating mechanic_profiles:", updateError);
    }

    // Stripe requires HTTPS URLs, not deep links
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

    const onboardingComplete = !!accountData.details_submitted;
    const chargesEnabled = !!accountData.charges_enabled;
    const payoutsEnabled = !!accountData.payouts_enabled;

    console.log("Updating mechanic_stripe_accounts...");
    await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .update({
        onboarding_complete: onboardingComplete,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        updated_at: now,
      })
      .eq("mechanic_id", user.id);

    // Update payout_method_status in profiles table
    // (keeps your intent: active if details + payouts; otherwise pending)
    const payoutStatus = onboardingComplete && payoutsEnabled ? "active" : "pending";

    await supabaseAdmin
      .from("profiles")
      .update({ payout_method_status: payoutStatus })
      .eq("id", user.id);

    console.log("Success! Returning account link, payout_method_status:", payoutStatus);

    return json(
      {
        url: accountLink.url,
        accountId: stripeAccountId,
        status: onboardingComplete
          ? (chargesEnabled && payoutsEnabled ? "active" : "pending")
          : "pending",
      },
      200
    );
  } catch (error) {
    console.error("Error creating account link:", error);
    return json({ error: error?.message || "Failed to create account link" }, 500);
  }
});
