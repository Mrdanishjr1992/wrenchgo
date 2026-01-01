import { supabase } from "./supabase";

export type IDVerificationStatus = "none" | "pending" | "verified" | "rejected";

export interface IDVerificationInfo {
  status: IDVerificationStatus;
  uploadedAt: string | null;
  verifiedAt: string | null;
  rejectedReason: string | null;
  photoPath: string | null;
}

export const checkIDVerification = async (userId?: string): Promise<IDVerificationInfo | null> => {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      targetUserId = user.id;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id_status, id_uploaded_at, id_verified_at, id_rejected_reason, id_photo_path")
      .eq("id", targetUserId)
      .single();

    if (error) throw error;

    return {
      status: (data.id_status as IDVerificationStatus) || "none",
      uploadedAt: data.id_uploaded_at,
      verifiedAt: data.id_verified_at,
      rejectedReason: data.id_rejected_reason,
      photoPath: data.id_photo_path,
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

export const uploadIDPhoto = async (
  uri: string,
  userId: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `photo-id.${ext}`;
    const filePath = `${userId}/${fileName}`;

    // React Native compatible approach - fetch as blob and convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to base64 using FileReader (React Native compatible)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Convert base64 to Uint8Array for upload
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Delete existing files first
    const { data: existingFiles } = await supabase.storage
      .from("identity-docs")
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      for (const file of existingFiles) {
        await supabase.storage.from("identity-docs").remove([`${userId}/${file.name}`]);
      }
    }

    // Upload the file
    const { data, error } = await supabase.storage
      .from("identity-docs")
      .upload(filePath, bytes, {
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: true,
      });

    if (error) throw error;

    // Update profile with new ID status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        id_photo_path: data.path,
        id_status: "pending",
        id_uploaded_at: new Date().toISOString(),
        id_verified_at: null,
        id_rejected_reason: null,
      })
      .eq("auth_id", userId)
;

    if (updateError) throw updateError;

    // Note: The database trigger will automatically call the Edge Function
    // No need to call it manually here to avoid infinite loops
    console.log("[ID VERIFICATION] Upload complete, database trigger will handle verification");

    return { success: true, path: data.path };
  } catch (error: any) {
    console.error("[ID VERIFICATION] Upload error:", error);
    return { success: false, error: error.message || "Failed to upload ID photo" };
  }
};

export const triggerAutoVerification = async (
  userId: string,
  filePath: string
): Promise<void> => {
  console.log("[ID VERIFICATION] Triggering auto-verification for:", { userId, filePath });

  const { data, error } = await supabase.functions.invoke("clever-responder", {
    body: { userId, filePath },
  });

  if (error) {
    console.error("[ID VERIFICATION] Edge Function error details:", {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      context: error.context,
    });

    // Try to read the response body for more details
    if (error.context && error.context._bodyInit) {
      try {
        const errorBody = await error.context.text();
        console.error("[ID VERIFICATION] Error response body:", errorBody);
      } catch (e) {
        console.error("[ID VERIFICATION] Could not read error body:", e);
      }
    }

    throw error;
  }

  console.log("[ID VERIFICATION] Auto-verification result:", data);
};

export const getIDPhotoUrl = async (
  path: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from("identity-docs")
      .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
  } catch (error: any) {
    console.error("[ID VERIFICATION] Failed to get signed URL:", error);
    return null;
  }
};

export const deleteIDPhoto = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: existingFiles } = await supabase.storage
      .from("identity-docs")
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const filePaths = existingFiles.map(file => `${userId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from("identity-docs")
        .remove(filePaths);

      if (deleteError) throw deleteError;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        id_photo_path: null,
        id_status: null,
        id_uploaded_at: null,
        id_verified_at: null,
        id_rejected_reason: null,
        id_verified_by: null,
      })
      .eq("auth_id", userId)
;

    if (updateError) throw updateError;

    return { success: true };
  } catch (error: any) {
    console.error("[ID VERIFICATION] Delete error:", error);
    return { success: false, error: error.message || "Failed to delete ID photo" };
  }
};

