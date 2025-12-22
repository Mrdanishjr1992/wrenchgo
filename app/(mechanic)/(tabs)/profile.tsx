import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
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

type MechanicProfileRow = {
  user_id: string;
  shop_name: string | null;
  bio: string | null;
  service_radius_miles: number;
  available_now: boolean;
  next_available_at: string | null;
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

export default function MechanicProfile() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [mp, setMp] = useState<MechanicProfileRow | null>(null);

  // editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [bio, setBio] = useState("");
  const [radius, setRadius] = useState("15");
  const [availableNow, setAvailableNow] = useState(true);

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

      // mechanic_profiles might not exist yet for some users -> create on save if missing
      const { data: m, error: mErr } = await supabase
        .from("mechanic_profiles")
        .select("user_id,shop_name,bio,service_radius_miles,available_now,next_available_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (mErr) throw mErr;

      setProfile(p as any);
      setMp((m as any) ?? null);

      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setShopName(m?.shop_name ?? "");
      setBio(m?.bio ?? "");
      setRadius(String(m?.service_radius_miles ?? 15));
      setAvailableNow(m?.available_now ?? true);
    } catch (e: any) {
      Alert.alert("Profile error", e?.message ?? "Failed to load profile.");
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

      const r = Number(radius);
      if (!Number.isFinite(r) || r <= 0) {
        Alert.alert("Invalid radius", "Enter a valid number like 15.");
        return;
      }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", userId);
      if (pErr) throw pErr;

      // upsert mechanic profile (create if missing)
      const { error: mErr } = await supabase
        .from("mechanic_profiles")
        .upsert(
          {
            user_id: userId,
            shop_name: shopName.trim() || null,
            bio: bio.trim() || null,
            service_radius_miles: r,
            available_now: availableNow,
            next_available_at: null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );
      if (mErr) throw mErr;

      Alert.alert("Saved", "Your profile has been updated.");
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
        <Text style={{ marginTop: 10, ...text.muted }}>Loading profile…</Text>
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
          <Text style={text.title}>Profile</Text>
          <Text style={text.muted}>Keep your info updated for customers.</Text>
        </View>

        <Card title="Availability">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 4 }}>
              <Text style={text.section}>Available now</Text>
              <Text style={text.muted}>
                Show up as available for new requests.
              </Text>
            </View>
            <Switch
              value={availableNow}
              onValueChange={setAvailableNow}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </Card>

        <Card title="Basics">
          <Text style={text.muted}>Full name</Text>
          <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />

          <Text style={text.muted}>Phone</Text>
          <Input value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" />
        </Card>

        <Card title="Shop">
          <Text style={text.muted}>Shop name</Text>
          <Input value={shopName} onChangeText={setShopName} placeholder="Mobile Mechanic / Shop name" />

          <Text style={text.muted}>Service radius (miles)</Text>
          <Input value={radius} onChangeText={setRadius} placeholder="15" keyboardType="number-pad" />

          <Text style={text.muted}>Bio</Text>
          <Input
            value={bio}
            onChangeText={setBio}
            placeholder="What do you specialize in?"
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              color: colors.textPrimary,
              minHeight: 90,
              textAlignVertical: "top",
            }}
          />
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
