// src/hooks/useDeleteAccount.ts
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import * as Device from "expo-device";

interface DeleteAccountOptions {
  reason?: string;
}

export const useDeleteAccount = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const deleteAccount = async (options?: DeleteAccountOptions) => {
    try {
      setIsDeleting(true);

      console.log("[DELETE ACCOUNT] Starting deletion process...");

      // Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("[DELETE ACCOUNT] Session error:", sessionError);
        throw new Error("No active session");
      }

      console.log("[DELETE ACCOUNT] Session found, user ID:", session.user.id);

      // Get user agent info
      const userAgent = `${Platform.OS} ${Platform.Version} - ${Device.modelName || "Unknown"}`;

      console.log("[DELETE ACCOUNT] Calling Edge Function...");

      // Get Supabase URL from env
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase configuration missing");
      }

      // Call Edge Function with better error handling
      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            reason: options?.reason,
            userAgent,
          }),
        }
      );

      console.log("[DELETE ACCOUNT] Response status:", response.status);

      const responseText = await response.text();
      console.log("[DELETE ACCOUNT] Response body:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("[DELETE ACCOUNT] Failed to parse response:", e);
        throw new Error(`Server error: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error("[DELETE ACCOUNT] Non-OK response:", data);
        throw new Error(data?.error || `Server returned ${response.status}`);
      }

      if (!data?.success) {
        console.error("[DELETE ACCOUNT] Deletion failed:", data?.error);
        throw new Error(data?.error || "Failed to delete account");
      }

      console.log("[DELETE ACCOUNT] Deletion successful, signing out...");

      // Sign out locally
      await supabase.auth.signOut();

      console.log("[DELETE ACCOUNT] Signed out, navigating to index...");

      // Navigate to index (landing/login page)
      router.replace("/");

      // Show success message after navigation
      setTimeout(() => {
        Alert.alert(
          "Account Deleted",
          "Your account has been successfully deleted.",
          [{ text: "OK" }]
        );
      }, 500);

      return { success: true };
    } catch (error: any) {
      console.error("[DELETE ACCOUNT] Error:", error);
      console.error("[DELETE ACCOUNT] Error message:", error.message);

      Alert.alert(
        "Deletion Failed",
        `${error.message || "Failed to delete account"}\n\nPlease contact support if this persists.`,
        [{ text: "OK" }]
      );

      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (options?: DeleteAccountOptions) => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.\n\n• You will be signed out immediately\n• Your profile and data will be removed\n• You cannot use this email to register again without approval\n\nTo reactivate your account in the future, you must contact support.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This is your last chance. Delete your account permanently?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: () => deleteAccount(options),
                },
              ]
            );
          },
        },
      ]
    );
  };

  return {
    deleteAccount,
    confirmDelete,
    isDeleting,
  };
};
