import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";

export function useProfile(router: any) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, photo_url, role")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(data);
    } catch (e: any) {
      Alert.alert("Profile error", e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const updateProfile = async (payload: {
    full_name?: string | null;
    phone?: string | null;
    photo_url?: string | null;
  }) => {
    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      Alert.alert("Saved", "Profile updated");
    } catch (e: any) {
      Alert.alert("Save error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  };

  return {
    profile,
    loading,
    saving,
    loadProfile,
    updateProfile,
    signOut,
  };
}
