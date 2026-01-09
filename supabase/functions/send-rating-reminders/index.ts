import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface EligibleUser {
  user_id: string;
  push_token: string;
  push_number: number;
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: eligibleUsers, error: queryError } = await supabase
      .rpc("get_push_eligible_users");

    if (queryError) {
      throw new Error(`Failed to get eligible users: ${queryError.message}`);
    }

    const users = (eligibleUsers || []) as EligibleUser[];
    console.log(`Found ${users.length} eligible users for rating push`);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const pushMessage = {
          to: user.push_token,
          sound: "default",
          title: "Enjoying WrenchGo?",
          body: "Could you take 10 seconds to rate the app? It really helps.",
          data: {
            type: "rating_reminder",
            url: "wrenchgo://rate",
          },
        };

        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
          },
          body: JSON.stringify(pushMessage),
        });

        const result = await response.json();

        if (result.data?.[0]?.status === "error") {
          console.error(`Push failed for ${user.user_id}:`, result.data[0].message);
          failed++;
          continue;
        }

        await supabase.rpc("record_rating_push", { p_user_id: user.user_id });
        sent++;
        console.log(`Sent rating push #${user.push_number} to ${user.user_id}`);
      } catch (err) {
        console.error(`Error processing user ${user.user_id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eligible: users.length,
        sent,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-rating-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
