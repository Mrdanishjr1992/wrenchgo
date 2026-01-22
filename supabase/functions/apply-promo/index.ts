import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      promo_id, 
      payment_id, 
      discount_cents, 
      quote_amount_cents, 
      platform_fee_cents,
      idempotency_key 
    } = await req.json();

    if (!promo_id || !payment_id || discount_cents === undefined) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "MISSING_PARAMS" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotency_key || `${user.id}-${promo_id}-${payment_id}-${Date.now()}`;

    // Call the atomic application function
    const { data, error } = await supabase.rpc("apply_promo_atomic", {
      p_user_id: user.id,
      p_promo_id: promo_id,
      p_payment_id: payment_id,
      p_discount_cents: discount_cents,
      p_quote_amount_cents: quote_amount_cents || 0,
      p_platform_fee_cents: platform_fee_cents || 0,
      p_idempotency_key: finalIdempotencyKey,
    });

    if (error) {
      console.error("Application error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "APPLICATION_ERROR",
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: data.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "SERVER_ERROR" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
