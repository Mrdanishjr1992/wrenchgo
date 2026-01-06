import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function stripeGet(endpoint: string) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { setupIntentId } = await req.json();
    if (!setupIntentId) throw new Error("Missing required field: setupIntentId");

    let { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || "", role: "customer" })
        .select("id")
        .single();
      if (createError || !newProfile) throw new Error("Profile not found");
      profile = newProfile;
    }

    const setupIntent = await stripeGet(`setup_intents/${setupIntentId}`);
    if (!setupIntent.payment_method) throw new Error("No payment method attached to setup intent");

    const paymentMethodId = setupIntent.payment_method;
    const customerId = setupIntent.customer;

    const paymentMethod = await stripeGet(`payment_methods/${paymentMethodId}`);
    if (!paymentMethod.card) throw new Error("Invalid payment method");

    const { data: existingMethod } = await supabase
      .from("customer_payment_methods")
      .select("id")
      .eq("customer_id", profile.id)
      .eq("stripe_payment_method_id", paymentMethodId)
      .maybeSingle();

    if (existingMethod) {
      return new Response(JSON.stringify({ success: true, message: "Payment method already saved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    await supabase.from("customer_payment_methods").update({ is_default: false }).eq("customer_id", profile.id);

    const { error: insertError } = await supabase.from("customer_payment_methods").insert({
      customer_id: profile.id,
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
      card_brand: paymentMethod.card.brand,
      card_last4: paymentMethod.card.last4,
      card_exp_month: paymentMethod.card.exp_month,
      card_exp_year: paymentMethod.card.exp_year,
      is_default: true,
    });

    if (insertError) throw new Error("Failed to save payment method");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
