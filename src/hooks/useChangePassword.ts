import { useState } from "react";
import { supabase } from "../lib/supabase";

interface ChangePasswordResult {
  success: boolean;
  error?: string;
  isOAuthUser?: boolean;
}

export const useChangePassword = () => {
  const [isChanging, setIsChanging] = useState(false);

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult> => {
    try {
      setIsChanging(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return { success: false, error: "No active session. Please sign in again." };
      }

      const user = session.user;

      const isOAuthUser =
        user.app_metadata?.provider === "google" ||
        user.app_metadata?.providers?.includes("google");

      if (isOAuthUser && !user.email?.includes("@")) {
        return {
          success: false,
          isOAuthUser: true,
          error:
            "You signed in with Google. To change your password, manage it in your Google account settings.",
        };
      }

      if (newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
      }

      if (currentPassword) {
        const { error: reAuthError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });

        if (reAuthError) {
          return { success: false, error: "Current password is incorrect." };
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error("[CHANGE PASSWORD] Error:", error);
      return { success: false, error: error.message || "Failed to change password." };
    } finally {
      setIsChanging(false);
    }
  };

  return { changePassword, isChanging };
};
