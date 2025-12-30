import { supabase } from "./supabase";

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
  });

  if (error) throw error;
}
