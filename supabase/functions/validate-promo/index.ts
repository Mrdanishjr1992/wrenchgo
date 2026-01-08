import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { promo_code, quote_amount_cents, platform_fee_cents } = await req.json();

    if (!promo_code || !quote_amount_cents) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error_code: "MISSING_PARAMS",
        user_message: "Missing required parameters" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the DB validation function (read-only, no mutations)
    const { data, error } = await supabase.rpc("validate_promo_eligibility", {
      p_user_id: user.id,
      p_promo_code: promo_code,
      p_quote_amount_cents: quote_amount_cents,
      p_platform_fee_cents: platform_fee_cents || null,
    });

    if (error) {
      console.error("Validation error:", error);
      return new Response(JSON.stringify({ 
        valid: false, 
        error_code: "VALIDATION_ERROR",
        user_message: "Unable to validate promo code" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ 
      valid: false, 
      error_code: "SERVER_ERROR",
      user_message: "An error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
