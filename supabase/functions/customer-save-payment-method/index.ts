import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno";
import { corsHeadersFor, json, requireEnv } from "../_shared/helpers.ts";

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  const headers = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" }, headers);

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json(401, { error: "Unauthorized" }, headers);

    const body = await req.json().catch(() => null);
    const setupIntentId = body?.setupIntentId;
    if (!setupIntentId) return json(400, { error: "Missing required field: setupIntentId" }, headers);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return json(404, { error: "Profile not found" }, headers);
    if (!profile.stripe_customer_id) return json(400, { error: "No Stripe customer found. Add a card first." }, headers);

    // Verify SI belongs to this user + customer
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== "succeeded") {
      return json(400, { error: "SetupIntent not succeeded", status: setupIntent.status }, headers);
    }

    const siCustomer = setupIntent.customer as string | null;
    if (!siCustomer || siCustomer !== profile.stripe_customer_id) {
      return json(403, { error: "SetupIntent customer mismatch" }, headers);
    }

    const siUserId = (setupIntent.metadata?.user_id || "").toString();
    if (siUserId && siUserId !== user.id) {
      return json(403, { error: "SetupIntent metadata mismatch" }, headers);
    }

    const paymentMethodId = setupIntent.payment_method as string | null;
    if (!paymentMethodId) return json(400, { error: "No payment method attached to setup intent" }, headers);

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.type !== "card" || !pm.card) return json(400, { error: "Invalid payment method type" }, headers);

    // If already saved, return success
    const { data: existing } = await supabase
      .from("customer_payment_methods")
      .select("id, deleted_at")
      .eq("customer_id", profile.id)
      .eq("stripe_payment_method_id", paymentMethodId)
      .maybeSingle();

    if (existing && !existing.deleted_at) {
      await supabase.from("profiles").update({ payment_method_status: "active" }).eq("id", profile.id);
      return json(200, { success: true, message: "Payment method already saved" }, headers);
    }

    // Clear defaults
    await supabase
      .from("customer_payment_methods")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("customer_id", profile.id)
      .is("deleted_at", null);

    // Insert new default PM row
    const { error: insertError } = await supabase.from("customer_payment_methods").insert({
      customer_id: profile.id,
      stripe_customer_id: profile.stripe_customer_id,
      stripe_payment_method_id: paymentMethodId,
      card_brand: pm.card.brand,
      card_last4: pm.card.last4,
      card_exp_month: pm.card.exp_month,
      card_exp_year: pm.card.exp_year,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) return json(500, { error: "Failed to save payment method", details: insertError.message }, headers);

    await supabase.from("profiles").update({
      payment_method_status: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);

    return json(200, { success: true }, headers);
  } catch (e: any) {
    console.error("[SAVE_PM] Error:", e?.message || e);
    return json(500, { error: e?.message || "Internal server error" }, headers);
  }
});
