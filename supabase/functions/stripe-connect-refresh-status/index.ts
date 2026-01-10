import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function getBearerToken(req: Request) {
  const raw = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  // Accept "Bearer <token>" with extra spaces/case
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server misconfigured: missing Supabase env vars" }, 500);
    }
    if (!stripeSecretKey) {
      return json({ error: "Server misconfigured: missing STRIPE_SECRET_KEY" }, 500);
    }

    const token = getBearerToken(req);
    if (!token) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    // Admin client for database updates (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user with token
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: payoutAccount, error: payoutAccountError } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .select("stripe_account_id")
      .eq("mechanic_id", user.id)
      .maybeSingle();

    if (payoutAccountError) {
      console.error("Error fetching mechanic_stripe_accounts:", payoutAccountError);
      return json({ error: "Failed to fetch Stripe account record" }, 500);
    }

    if (!payoutAccount?.stripe_account_id) {
      return json(
        { error: "No Stripe account found. Please complete onboarding first." },
        404
      );
    }

    const account = await stripe.accounts.retrieve(payoutAccount.stripe_account_id);

    console.log("Stripe account status:", {
      id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });

    const now = new Date().toISOString();

    const onboardingComplete = !!account.details_submitted;
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    // Same outcomes as your original logic:
    // - active: details_submitted && payouts_enabled
    // - pending: details_submitted && !payouts_enabled
    // - none: !details_submitted
    const payoutStatus = onboardingComplete
      ? (payoutsEnabled ? "active" : "pending")
      : "none";

    // Update mechanic_stripe_accounts
    const { error: stripeAccountError } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .update({
        onboarding_complete: onboardingComplete,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        updated_at: now,
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
        stripe_onboarding_complete: onboardingComplete,
        updated_at: now,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Error updating mechanic_profiles:", profileError);
    }

    // Update payout_method_status in profiles table
    const { error: payoutStatusError } = await supabaseAdmin
      .from("profiles")
      .update({ payout_method_status: payoutStatus })
      .eq("id", user.id);

    if (payoutStatusError) {
      console.error("Error updating payout_method_status:", payoutStatusError);
    }

    console.log("Updated user:", user.id, "payout_method_status:", payoutStatus);

    return json({
      stripeAccountId: account.id,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      payoutMethodStatus: payoutStatus,
    });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
