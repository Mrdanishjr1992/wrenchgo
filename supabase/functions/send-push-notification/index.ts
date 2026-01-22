import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
}

serve(async (req) => {
  try {
    const payload: PushPayload = await req.json();
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's push token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", payload.user_id)
      .single();

    if (profileError || !profile?.push_token) {
      console.log("No push token found for user:", payload.user_id);
      return new Response(
        JSON.stringify({ success: false, error: "No push token" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send push notification via Expo
    const pushMessage = {
      to: profile.push_token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        entityType: payload.entity_type,
        entityId: payload.entity_id,
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
      console.error("Push notification error:", result.data[0].message);
      return new Response(
        JSON.stringify({ success: false, error: result.data[0].message }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
