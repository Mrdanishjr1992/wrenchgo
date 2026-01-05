import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

serve(async (req) => {
  console.log("=== Function invoked ===");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== Customer Setup Payment Method Request ===");

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    console.log("Auth header value:", authHeader?.substring(0, 50));

    if (!authHeader) {
      console.error("No Authorization header provided");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);

    console.log("Creating Supabase client...");
    console.log("SUPABASE_URL:", supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!supabaseServiceKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client created");

    console.log("Verifying user token...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    console.log("User result:", { user: !!user, userId: user?.id, error: userError?.message });

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("auth_id", user.id)
      .single();

    console.log("Profile result:", { profile: !!profile, error: profileError?.message });

    if (profileError || !profile) {
      console.error("Profile not found for user:", user.id);
      return new Response(JSON.stringify({
        error: "Profile not found",
        details: profileError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Profile found:", profile.id);

    const { data: existingPaymentMethod } = await supabase
      .from("customer_payment_methods")
      .select("stripe_customer_id")
      .eq("customer_id", profile.id)
      .maybeSingle();

    console.log("Existing payment method:", !!existingPaymentMethod);

    let stripeCustomerId = existingPaymentMethod?.stripe_customer_id;

    if (!stripeCustomerId) {
      console.log("Creating new Stripe customer...");
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        name: profile.full_name,
        metadata: {
          user_id: user.id,
          profile_id: profile.id,
        },
      });
      stripeCustomerId = customer.id;
      console.log("Stripe customer created:", stripeCustomerId);
    }

    console.log("Creating setup intent...");
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: {
        user_id: user.id,
        profile_id: profile.id,
      },
    });

    console.log("Setup intent created:", setupIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        customerId: stripeCustomerId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating setup intent:", error);
    console.error("Error stack:", error.stack);
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
