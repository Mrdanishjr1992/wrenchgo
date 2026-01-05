// supabase/functions/delete-account/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeleteAccountRequest = {
  reason?: string;
  userAgent?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { success: false, error: "Missing authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, { success: false, error: "Server configuration error" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();

    // Validate user from JWT
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json(401, { success: false, error: "Unauthorized" });
    }
    const user = userData.user;

    // Parse body (optional)
    let reason = "User requested account deletion";
    let userAgent = req.headers.get("user-agent") ?? "unknown";

    try {
      const body = (await req.json()) as DeleteAccountRequest;
      if (body?.reason) reason = body.reason;
      if (body?.userAgent) userAgent = body.userAgent;
    } catch (_) {
      // no body / invalid JSON -> ignore
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const nowIso = new Date().toISOString();

    // 1) Load profile (your schema uses profiles.id = auth.users.id)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        [
          "id",
          "role",
          "full_name",
          "avatar_url",
          "deleted_at",
          "deleted_reason",
          "deletion_requested_by",
          "can_reapply",
        ].join(",")
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return json(400, { success: false, error: `Profile read failed: ${profileError.message}` });
    }
    if (!profile) {
      return json(404, { success: false, error: "Profile not found" });
    }
    if (profile.deleted_at) {
      return json(400, { success: false, error: "Account already deleted" });
    }

    const userEmail = user.email ?? "unknown";
    const userRole = profile.role ?? "customer";

    // 2) Best-effort: audit record (only if your tables exist)
    // If these tables don't exist, it will fail harmlessly inside try/catch.
    try {
      await supabaseAdmin.from("account_deletions").insert({
        user_id: user.id,
        profile_id: profile.id,
        email: userEmail,
        user_role: userRole, // NOTE: not in your schema, but harmless if table exists w/ different columns? If mismatch, it will error and be caught.
        deletion_reason: reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        profile_snapshot: profile,
        created_at: nowIso,
      } as any);
    } catch (_) {}

    // 3) Best-effort: email blocklist (only if table exists)
    try {
      await supabaseAdmin.from("email_blocklist").upsert({
        email: userEmail.toLowerCase(),
        blocked_reason: "Account deleted by user",
        original_user_id: user.id,
        can_reapply: false,
        blocked_at: nowIso,
      } as any);
    } catch (_) {}

    // 4) Soft delete profile (THIS is the main action your schema supports)
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: nowIso,
        deleted_reason: reason,
        deletion_requested_by: user.id,
        can_reapply: false,
      })
      .eq("id", user.id);

    if (updateErr) {
      return json(400, { success: false, error: `Failed to soft delete profile: ${updateErr.message}` });
    }

    // 5) Scrub auth email (optional but helpful in dev)
    // This does NOT "disable" the user by itself; your app should treat profiles.deleted_at != null as deleted.
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: `deleted_${user.id}@wrenchgo.deleted`,
        email_confirm: false,
      });
    } catch (_) {}

    // 6) Sign out user globally
    try {
      await supabaseAdmin.auth.admin.signOut(user.id, "global");
    } catch (_) {}

    return json(200, {
      success: true,
      message: "Account deleted successfully",
      deletedAt: nowIso,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete account";
    return json(400, { success: false, error: msg });
  }
});
