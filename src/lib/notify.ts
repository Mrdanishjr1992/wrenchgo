import { supabase } from "./supabase";

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  // Try RPC first, fallback to direct insert
  let inserted = false;
  
  try {
    const { error } = await supabase.rpc("notify_user", {
      p_user_id: params.userId,
      p_title: params.title,
      p_body: params.body ?? "",
      p_type: params.type,
      p_entity_type: params.entityType ?? null,
      p_entity_id: params.entityId ?? null,
    });

    if (!error) {
      inserted = true;
    } else {
      console.log("RPC notify_user not available, using direct insert");
    }
  } catch (e) {
    console.log("RPC notify_user failed, using direct insert");
  }

  // Fallback: direct insert into notifications table
  if (!inserted) {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: params.userId,
        title: params.title,
        body: params.body ?? "",
        type: params.type,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        is_read: false,
      });

      if (error) {
        console.error("Error inserting notification:", error);
      }
    } catch (e) {
      console.error("Failed to insert notification:", e);
    }
  }

  // Send push notification via edge function
  try {
    const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: params.userId,
        title: params.title,
        body: params.body ?? "",
        type: params.type,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
      },
    });

    if (pushError) {
      console.error("Error sending push notification:", pushError);
    }
  } catch (e) {
    console.error("Failed to invoke push notification function:", e);
  }
}
