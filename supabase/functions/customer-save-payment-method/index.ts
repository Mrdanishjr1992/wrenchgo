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

interface SavePaymentMethodRequest {
  setupIntentId: string;
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

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { setupIntentId }: SavePaymentMethodRequest = await req.json();

    if (!setupIntentId) {
      throw new Error("Missing required field: setupIntentId");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (!setupIntent.payment_method) {
      throw new Error("No payment method attached to setup intent");
    }

    const paymentMethodId = setupIntent.payment_method as string;
    const customerId = setupIntent.customer as string;

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (!paymentMethod.card) {
      throw new Error("Invalid payment method");
    }

    const { data: existingMethod } = await supabase
      .from("customer_payment_methods")
      .select("id")
      .eq("customer_id", profile.id)
      .eq("stripe_payment_method_id", paymentMethodId)
      .maybeSingle();

    if (existingMethod) {
      return new Response(
        JSON.stringify({ success: true, message: "Payment method already saved" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    await supabase
      .from("customer_payment_methods")
      .update({ is_default: false })
      .eq("customer_id", profile.id);

    const { error: insertError } = await supabase
      .from("customer_payment_methods")
      .insert({
        customer_id: profile.id,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        card_brand: paymentMethod.card.brand,
        card_last4: paymentMethod.card.last4,
        card_exp_month: paymentMethod.card.exp_month,
        card_exp_year: paymentMethod.card.exp_year,
        is_default: true,
      });

    if (insertError) {
      console.error("Failed to save payment method:", insertError);
      throw new Error("Failed to save payment method");
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error saving payment method:", error);
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