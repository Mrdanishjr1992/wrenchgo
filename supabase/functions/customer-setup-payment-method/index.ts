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

    // Load (or create) profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return json(500, { error: "Failed to load profile", details: profileError.message }, headers);

    let prof = profile;
    if (!prof) {
      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || "", role: "customer" })
        .select("id, full_name, email, stripe_customer_id")
        .single();
      if (createErr || !created) return json(500, { error: "Profile not found/created" }, headers);
      prof = created;
    }

    // Ensure Stripe customer exists and is persisted
    let stripeCustomerId = prof.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: prof.email || user.email || undefined,
        name: prof.full_name || undefined,
        metadata: { user_id: user.id, profile_id: prof.id },
      });
      stripeCustomerId = customer.id;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq("id", prof.id);

      if (updErr) console.error("[SETUP_PM] Failed to persist stripe_customer_id:", updErr.message);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { user_id: user.id, profile_id: prof.id },
    });

    return json(200, { clientSecret: setupIntent.client_secret, customerId: stripeCustomerId }, headers);
  } catch (e: any) {
    console.error("[SETUP_PM] Error:", e?.message || e);
    return json(500, { error: e?.message || "Internal server error" }, headers);
  }
});
