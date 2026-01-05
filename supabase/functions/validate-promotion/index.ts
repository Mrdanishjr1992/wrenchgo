import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  promotionCode: string;
  quoteAmountCents: number;
  userId?: string;
}

interface ValidationResponse {
  valid: boolean;
  promotion?: any;
  discountCents?: number;
  reason?: string;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { promotionCode, quoteAmountCents }: ValidationRequest = await req.json();

    if (!promotionCode || !quoteAmountCents) {
      throw new Error("Missing required fields");
    }

    const { data: promotion, error: promoError } = await supabase
      .from("promotions")
      .select("*")
      .eq("code", promotionCode.toUpperCase())
      .eq("active", true)
      .single();

    if (promoError || !promotion) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "Promotion code not found or inactive",
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

    if (now < startDate) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "Promotion has not started yet",
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (endDate && now > endDate) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "Promotion has expired",
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (
      promotion.max_redemptions &&
      promotion.current_redemptions >= promotion.max_redemptions
    ) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "Promotion has reached maximum redemptions",
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { data: userRedemptions } = await supabase
      .from("promotion_redemptions")
      .select("id")
      .eq("promotion_id", promotion.id)
      .eq("user_id", user.id);

    const userRedemptionCount = userRedemptions?.length || 0;

    if (userRedemptionCount >= (promotion.max_redemptions_per_user || 1)) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "You have already used this promotion code",
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (promotion.minimum_amount_cents && quoteAmountCents < promotion.minimum_amount_cents) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: `Minimum order amount is $${(promotion.minimum_amount_cents / 100).toFixed(2)}`,
        } as ValidationResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    let discountCents = 0;
    const customerPlatformFeeCents = 1500;

    if (promotion.type === "percent_discount" && promotion.percent_off) {
      discountCents = Math.round(
        (quoteAmountCents + customerPlatformFeeCents) * (promotion.percent_off / 100)
      );
    } else if (promotion.type === "fixed_discount" && promotion.amount_cents) {
      discountCents = promotion.amount_cents;
    } else if (promotion.type === "waive_platform_fee") {
      discountCents = customerPlatformFeeCents;
    }

    return new Response(
      JSON.stringify({
        valid: true,
        promotion: {
          code: promotion.code,
          type: promotion.type,
          description: promotion.description,
        },
        discountCents,
      } as ValidationResponse),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error validating promotion:", error);
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
