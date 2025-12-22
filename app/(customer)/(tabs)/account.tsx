import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
  role: "customer" | "mechanic" | "admin";
};

const Card = ({ title, children }: { title: string; children: any }) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    }}
  >
    <Text style={text.section}>{title}</Text>
    {children}
  </View>
);

const Input = (props: any) => (
  <TextInput
    placeholderTextColor={colors.textMuted}
    style={{
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      color: colors.textPrimary,
    }}
    {...props}
  />
);

export default function CustomerAccount() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = userData.user?.id;
      if (!userId) return;

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id,full_name,phone,photo_url,role")
        .eq("id", userId)
        .single();

      if (pErr) throw pErr;

      setProfile(p as any);
      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
    } catch (e: any) {
      Alert.alert("Account error", e?.message ?? "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      setSaving(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Saved", "Your account has been updated.");
      await load();
    } catch (e: any) {
      Alert.alert("Save error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading account…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>
        <View style={{ gap: 8 }}>
          <Text style={text.title}>Account</Text>
          <Text style={text.muted}>Manage your customer profile.</Text>
        </View>

        <Card title="Profile">
          <Text style={text.muted}>Full name</Text>
          <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />

          <Text style={text.muted}>Phone</Text>
          <Input value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" />

          <Text style={text.muted}>
            Role: <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{profile?.role ?? "customer"}</Text>
          </Text>
        </Card>

        <Card title="Quick Links">
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/jobs")}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.textPrimary }}>VIEW MY JOBS</Text>
          </Pressable>
        </Card>

        <Pressable
          onPress={save}
          disabled={saving}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ fontWeight: "900", color: "#000" }}>
            {saving ? "SAVING…" : "SAVE CHANGES"}
          </Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.textPrimary }}>SIGN OUT</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
