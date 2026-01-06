import { supabase } from "./supabase";

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const { error } = await supabase.rpc("notify_user", {
    p_user_id: params.userId,
    p_title: params.title,
    p_body: params.body ?? "",
    p_type: params.type,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
  });

  if (error) throw error;
}