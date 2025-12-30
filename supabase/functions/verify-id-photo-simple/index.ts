import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[SIMPLE-VERIFY] Function called");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, filePath } = await req.json();
    console.log("[SIMPLE-VERIFY] Received:", { userId, filePath });

    if (!userId || !filePath) {
      throw new Error("Missing userId or filePath");
    }

    // Just auto-approve for testing
    console.log("[SIMPLE-VERIFY] Auto-approving for testing...");

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        id_status: "verified",
        id_verified_at: new Date().toISOString(),
        id_rejected_reason: null,
        id_verified_by: "auto-test",
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[SIMPLE-VERIFY] Update error:", updateError);
      throw updateError;
    }

    console.log("[SIMPLE-VERIFY] Successfully verified user");

    return new Response(
      JSON.stringify({
        success: true,
        status: "verified",
        message: "Auto-approved for testing",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[SIMPLE-VERIFY] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
