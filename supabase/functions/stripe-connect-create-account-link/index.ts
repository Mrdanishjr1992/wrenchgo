import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

    // Check required environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      serviceRoleKeyPrefix: serviceRoleKey?.substring(0, 10),
      serviceRoleKeyPrefix: serviceRoleKey?.substring(0, 10),
      hasStripeKey: !!stripeKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required environment variables");
      return new Response(JSON.stringify({
        error: "Server configuration error",
        details: "Missing Supabase credentials"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user's JWT token
    console.log("Verifying user token...");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log("User result:", { user: !!user, error: userError?.message });

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({
        code: 401,
        message: "Invalid JWT",
        error: "Unauthorized",
        details: userError?.message || "No user found"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.id);

    // Use RPC function to bypass RLS
    const { data: profileData, error: profileError } = await supabaseAdmin
      .rpc("get_profile_for_stripe", { p_user_id: user.id });

    const profile = profileData?.[0];
    console.log("Profile query result:", { profile: !!profile, error: profileError?.message });

    if (profileError || !profile) {
      console.error("Profile not found for user:", user.id, "Error:", profileError?.message);
      return new Response(JSON.stringify({
        error: "Profile not found",
        details: profileError?.message || "No profile record exists"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingAccount, error: existingError } = await supabaseAdmin
      .from("mechanic_stripe_accounts")
      .select("stripe_account_id")
      .eq("mechanic_id", user.id)
      .maybeSingle();

    console.log("Existing account query:", { data: existingAccount, error: existingError?.message });

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

      console.log("Inserting into mechanic_stripe_accounts...");
      const { data: insertData, error: insertError } = await supabaseAdmin.from("mechanic_stripe_accounts").insert({
        mechanic_id: user.id,
        stripe_account_id: stripeAccountId,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      }).select();

      console.log("Insert result:", { data: insertData, error: insertError?.message, code: insertError?.code });

      if (insertError) {
        console.error("Error inserting mechanic_stripe_accounts:", JSON.stringify(insertError));
        throw new Error(`Failed to save Stripe account: ${insertError.message}`);
      }

      // Also update mechanic_profiles with the stripe_account_id
      const { error: updateError } = await supabaseAdmin.from("mechanic_profiles").update({
        stripe_account_id: stripeAccountId,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);

      if (updateError) {
        console.error("Error updating mechanic_profiles:", updateError);
      }
    } else {
      console.log("Using existing Stripe account:", stripeAccountId);
      // Ensure mechanic_profiles has the stripe_account_id (in case it was missed before)
      const { error: updateError } = await supabaseAdmin.from("mechanic_profiles").update({
        stripe_account_id: stripeAccountId,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);

      if (updateError) {
        console.error("Error updating mechanic_profiles:", updateError);
      }
    }

    // Stripe requires HTTPS URLs, not deep links
    // We'll use a web redirect that then opens the app
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
        onboarding_complete: accountData.details_submitted || false,
        charges_enabled: accountData.charges_enabled || false,
        payouts_enabled: accountData.payouts_enabled || false,
        updated_at: new Date().toISOString(),
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
