import { supabase } from "./supabase";

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  // Insert notification into database
  const { error } = await supabase.rpc("notify_user", {
    p_user_id: params.userId,
    p_title: params.title,
    p_body: params.body ?? "",
    p_type: params.type,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
  });

  if (error) {
    console.error("Error creating notification:", error);
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
