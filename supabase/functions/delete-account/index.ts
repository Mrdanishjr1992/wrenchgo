// supabase/functions/delete-account/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";




const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteAccountRequest {
  reason?: string;
  userAgent?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[DELETE ACCOUNT] Request received");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[DELETE ACCOUNT] Missing authorization header");
      throw new Error("Missing authorization header");
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("[DELETE ACCOUNT] Missing environment variables");
      throw new Error("Server configuration error");
    }

    console.log("[DELETE ACCOUNT] Environment variables loaded");

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("[DELETE ACCOUNT] Admin client created");

    // Extract JWT token from Authorization header
    const token = authHeader.replace("Bearer ", "");

    // Get user from JWT using admin client
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error("[DELETE ACCOUNT] User error:", userError);
      throw new Error("Unauthorized: " + userError.message);
    }

    if (!user) {
      console.error("[DELETE ACCOUNT] No user found");
      throw new Error("Unauthorized: Auth session missing!");
    }

    console.log(`[DELETE ACCOUNT] User authenticated: ${user.id}`);

    // Parse request body
    let reason = "User requested account deletion";
    let userAgent = "unknown";

    try {
      const body: DeleteAccountRequest = await req.json();
      reason = body.reason || reason;
      userAgent = body.userAgent || userAgent;
    } catch (e) {
      console.log("[DELETE ACCOUNT] No body or invalid JSON, using defaults");
    }

    // Get user's IP address
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    console.log(`[DELETE ACCOUNT] Starting deletion for user: ${user.id}`);

    // 1. Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[DELETE ACCOUNT] Profile error:", profileError);
      throw new Error("Profile not found: " + profileError.message);
    }

    if (!profile) {
      console.error("[DELETE ACCOUNT] No profile found");
      throw new Error("Profile not found");
    }

    console.log(`[DELETE ACCOUNT] Profile found: ${profile.id}`);

    // Check if already deleted
    if (profile.deleted_at) {
      console.log("[DELETE ACCOUNT] Account already deleted");
      throw new Error("Account already deleted");
    }

    const userType = profile.user_type;
    const userEmail = user.email || profile.email || "unknown";

    console.log(`[DELETE ACCOUNT] User type: ${userType}, Email: ${userEmail}`);

    const now = new Date().toISOString();

    // 2. Create audit record with profile snapshot (if table exists)
    try {
      const { error: auditError } = await supabaseAdmin
        .from("account_deletions")
        .insert({
          user_id: user.id,
          profile_id: profile.id,
          email: userEmail,
          user_type: userType,
          deletion_reason: reason,
          ip_address: ipAddress,
          user_agent: userAgent,
          profile_snapshot: profile,
        });

      if (auditError) {
        console.error("[DELETE ACCOUNT] Audit error:", auditError);
        // Don't throw - continue with deletion even if audit fails
      } else {
        console.log("[DELETE ACCOUNT] Audit record created");
      }
    } catch (e) {
      console.error("[DELETE ACCOUNT] Audit table may not exist:", e);
    }

    // 3. Add email to blocklist (if table exists)
    try {
      const { error: blocklistError } = await supabaseAdmin
        .from("email_blocklist")
        .insert({
          email: userEmail.toLowerCase(),
          blocked_reason: "Account deleted by user",
          original_user_id: user.id,
          can_reapply: false,
        });

      if (blocklistError) {
        // If email already in blocklist, update it
        if (blocklistError.code === "23505") {
          await supabaseAdmin
            .from("email_blocklist")
            .update({
              blocked_at: now,
              blocked_reason: "Account deleted by user (re-deletion)",
              original_user_id: user.id,
              can_reapply: false,
            })
            .eq("email", userEmail.toLowerCase());
          console.log("[DELETE ACCOUNT] Email blocklist updated");
        } else {
          console.error("[DELETE ACCOUNT] Blocklist error:", blocklistError);
        }
      } else {
        console.log("[DELETE ACCOUNT] Email added to blocklist");
      }
    } catch (e) {
      console.error("[DELETE ACCOUNT] Blocklist table may not exist:", e);
    }

    // 4. Soft delete profile
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: now,
        deleted_reason: reason,
        deletion_requested_by: user.id,
        can_reapply: false,
      })
      .eq("id", user.id);

    if (profileUpdateError) {
      console.error("[DELETE ACCOUNT] Profile update error:", profileUpdateError);
      throw new Error("Failed to soft delete profile: " + profileUpdateError.message);
    }

    console.log("[DELETE ACCOUNT] Profile soft deleted");

    // 5. Soft delete related data (if columns exist)
    try {
      // Soft delete jobs (as customer or mechanic)
      await supabaseAdmin
        .from("jobs")
        .update({ deleted_at: now, deleted_by: user.id })
        .or(`customer_id.eq.${user.id},mechanic_id.eq.${user.id}`)
        .is("deleted_at", null);
      console.log("[DELETE ACCOUNT] Jobs soft deleted");
    } catch (e) {
      console.error("[DELETE ACCOUNT] Jobs deletion error:", e);
    }

    try {
      // Soft delete notifications
      await supabaseAdmin
        .from("notifications")
        .update({ deleted_at: now, deleted_by: user.id })
        .eq("user_id", user.id)
        .is("deleted_at", null);
      console.log("[DELETE ACCOUNT] Notifications soft deleted");
    } catch (e) {
      console.error("[DELETE ACCOUNT] Notifications deletion error:", e);
    }

    try {
      // Soft delete messages (if table exists)
      await supabaseAdmin
        .from("messages")
        .update({ deleted_at: now, deleted_by: user.id })
        .eq("sender_id", user.id)
        .is("deleted_at", null);
      console.log("[DELETE ACCOUNT] Messages soft deleted");
    } catch (e) {
      console.error("[DELETE ACCOUNT] Messages deletion error:", e);
    }

    // 6. Disable auth user (prevents login via trigger checking deleted_at)
    try {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: `deleted_${user.id}@wrenchgo.deleted`,
        email_confirm: false,
      });

      if (authUpdateError) {
        console.error("[DELETE ACCOUNT] Auth update error:", authUpdateError);
      } else {
        console.log("[DELETE ACCOUNT] Auth user disabled");
      }
    } catch (e) {
      console.error("[DELETE ACCOUNT] Auth disable error:", e);
    }

    // 7. Sign out user (invalidate all sessions)
    try {
      await supabaseAdmin.auth.admin.signOut(user.id, "global");
      console.log("[DELETE ACCOUNT] User signed out globally");
    } catch (e) {
      console.error("[DELETE ACCOUNT] Sign out error:", e);
    }

    console.log("[DELETE ACCOUNT] Deletion completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account deleted successfully",
        deletedAt: now,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[DELETE ACCOUNT] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to delete account";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
