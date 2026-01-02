import { supabase } from "./supabase";

export type IDVerificationStatus = "none" | "pending" | "verified" | "rejected";

export interface IDVerificationInfo {
  status: IDVerificationStatus;
  uploadedAt: string | null;
  verifiedAt: string | null;
  rejectedReason: string | null;
  photoPath: string | null;
}

/**
 * Reads ID verification fields from profiles.
 * - If userId is omitted, it uses the currently authenticated user.
 * - IMPORTANT: profiles lookup uses auth_id = user.id
 */
export const checkIDVerification = async (userId?: string): Promise<IDVerificationInfo | null> => {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!data?.user) return null;
      targetUserId = data.user.id;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id_status, id_uploaded_at, id_verified_at, id_rejected_reason, id_photo_path")
      .eq("auth_id", targetUserId)
      .single();

    if (error) throw error;

    return {
      status: (profile?.id_status as IDVerificationStatus) || "none",
      uploadedAt: profile?.id_uploaded_at ?? null,
      verifiedAt: profile?.id_verified_at ?? null,
      rejectedReason: profile?.id_rejected_reason ?? null,
      photoPath: profile?.id_photo_path ?? null,
    };
  } catch (error) {
    console.error("[ID VERIFICATION] Check error:", error);
    return null;
  }
};

export const isIDVerified = async (userId?: string): Promise<boolean> => {
  const info = await checkIDVerification(userId);
  return info?.status === "verified";
};

function uriToBytes(uri: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const response = await fetch(uri);
      const blob = await response.blob();

      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.includes(",") ? base64String.split(",")[1] : base64String;
          res(base64Data);
        };
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      resolve({ bytes, contentType, ext });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Uploads the user's ID photo to storage bucket: identity-docs
 * Path: {userId}/photo-id.{ext}
 *
 * NOTE:
 * - If you still see: "new row violates row-level security policy"
 *   that's a Storage RLS/policy problem (bucket policies), not this code.
 */
export const uploadIDPhoto = async (
  uri: string,
  userId: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    console.log("[ID VERIFICATION] auth", authData?.user?.id, authErr);

    if (authErr || !authData?.user) {
      return { success: false, error: "Authentication failed. Please sign in again." };
    }

    console.log("[ID VERIFICATION] Converting image to bytes...");
    const { bytes, contentType, ext } = await uriToBytes(uri);
    console.log("[ID VERIFICATION] Image converted:", { contentType, ext, size: bytes.length });

    const fileName = `photo-id.${ext}`;
    const filePath = `${userId}/${fileName}`;

    console.log("[ID VERIFICATION] Checking for existing files...");
    const { data: existingFiles, error: listErr } = await supabase.storage.from("identity-docs").list(userId);
    
    if (listErr) {
      console.error("[ID VERIFICATION] List error:", listErr);
      return { success: false, error: `Storage access error: ${listErr.message}. Check if 'identity-docs' bucket exists.` };
    }

    if (existingFiles?.length) {
      console.log("[ID VERIFICATION] Removing existing files:", existingFiles.length);
      const toRemove = existingFiles.map((f) => `${userId}/${f.name}`);
      const { error: rmErr } = await supabase.storage.from("identity-docs").remove(toRemove);
      if (rmErr) {
        console.error("[ID VERIFICATION] Remove error:", rmErr);
      }
    }

    console.log("[ID VERIFICATION] Uploading to:", filePath);
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("identity-docs")
      .upload(filePath, bytes, { contentType, upsert: true });

    if (uploadErr) {
      console.error("[ID VERIFICATION] Upload error:", uploadErr);
      return { success: false, error: `Upload failed: ${uploadErr.message}. Check storage bucket RLS policies.` };
    }
    
    if (!uploadData?.path) {
      return { success: false, error: "Upload succeeded but no path was returned." };
    }

    console.log("[ID VERIFICATION] uploaded:", uploadData.path);

    console.log("[ID VERIFICATION] Checking profile exists...");
    const { data: profileCheck, error: profileCheckErr } = await supabase
      .from("profiles")
      .select("auth_id")
      .eq("auth_id", userId)
      .single();

    if (profileCheckErr || !profileCheck) {
      console.error("[ID VERIFICATION] Profile not found:", profileCheckErr);
      return { success: false, error: "Profile not found. Please contact support." };
    }

    console.log("[ID VERIFICATION] Updating profile...");
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        id_photo_path: uploadData.path,
        id_status: "pending",
        id_uploaded_at: new Date().toISOString(),
        id_verified_at: null,
        id_rejected_reason: null,
      })
      .eq("auth_id", userId);

    if (updateErr) {
      console.error("[ID VERIFICATION] Profile update error:", updateErr);
      return { success: false, error: `Failed to update profile: ${updateErr.message}` };
    }

    console.log("[ID VERIFICATION] Upload complete. Trigger (if configured) will handle verification.");

    return { success: true, path: uploadData.path };
  } catch (error: any) {
    console.error("[ID VERIFICATION] Upload error:", error);
    return { success: false, error: error?.message || "Failed to upload ID photo" };
  }
};

export const triggerAutoVerification = async (userId: string, filePath: string): Promise<void> => {
  console.log("[ID VERIFICATION] Triggering auto-verification for:", { userId, filePath });

  const { data, error } = await supabase.functions.invoke("clever-responder", {
    body: { userId, filePath },
  });

  if (error) {
    console.error("[ID VERIFICATION] Edge Function error details:", {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      context: (error as any).context,
    });

    throw error;
  }

  console.log("[ID VERIFICATION] Auto-verification result:", data);
};

export const getIDPhotoUrl = async (path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage.from("identity-docs").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch (error: any) {
    console.error("[ID VERIFICATION] Failed to get signed URL:", error);
    return null;
  }
};

export const deleteIDPhoto = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: existingFiles, error: listErr } = await supabase.storage.from("identity-docs").list(userId);
    if (listErr) throw listErr;

    if (existingFiles?.length) {
      const paths = existingFiles.map((f) => `${userId}/${f.name}`);
      const { error: rmErr } = await supabase.storage.from("identity-docs").remove(paths);
      if (rmErr) throw rmErr;
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        id_photo_path: null,
        id_status: "none",
        id_uploaded_at: null,
        id_verified_at: null,
        id_rejected_reason: null,
        id_verified_by: null,
      })
      .eq("auth_id", userId);

    if (updateErr) throw updateErr;

    return { success: true };
  } catch (error: any) {
    console.error("[ID VERIFICATION] Delete error:", error);
    return { success: false, error: error?.message || "Failed to delete ID photo" };
  }
};

/**
 * TEMPORARY: Manual verification for testing/development
 * In production, this should be admin-only or removed
 */
export const manualVerifyID = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("[ID VERIFICATION] Manually verifying user:", userId);
    
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        id_status: "verified",
        id_verified_at: new Date().toISOString(),
        id_rejected_reason: null,
      })
      .eq("auth_id", userId);

    if (updateErr) {
      console.error("[ID VERIFICATION] Manual verify error:", updateErr);
      return { success: false, error: updateErr.message };
    }

    console.log("[ID VERIFICATION] Manual verification complete");
    return { success: true };
  } catch (error: any) {
    console.error("[ID VERIFICATION] Manual verify error:", error);
    return { success: false, error: error?.message || "Failed to verify ID" };
  }
};
