// /app/(auth)/choose-role.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";

type Role = "customer" | "mechanic";

export default function ChooseRole() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  const canContinue = useMemo(() => !saving && !loading && !!role, [saving, loading, role]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);

        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr) console.log("choose-role getSession error:", sErr.message);

        const user = sessionData.session?.user;
        if (!user) {
          router.replace("/(auth)/sign-in");
          return;
        }

        // If profile already has a role, skip this screen
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (pErr) console.log("choose-role: profile fetch error:", pErr.message);

        if (profile?.role) {
          router.replace("/");
          return;
        }

        if (mounted) setLoading(false);
      } catch (e: any) {
        console.log("choose-role init error:", e?.message);
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  const saveRole = async () => {
    try {
      if (!role) return;

      setSaving(true);

      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (sErr) console.log("choose-role getSession error:", sErr.message);

      const user = sessionData.session?.user;
      if (!user) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase.rpc("set_user_role", {
        new_role: role,
      });

      if (error) throw error;

      console.log("choose-role: role set successfully", { role, userId: user.id });

      router.replace("/");
    } catch (e: any) {
      console.log("choose-role save error:", e?.message);
      Alert.alert("Couldn’t save role", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const RoleCard = ({
    r,
    title,
    subtitle,
    emoji,
  }: {
    r: Role;
    title: string;
    subtitle: string;
    emoji: string;
  }) => {
    const active = role === r;
    return (
      <Pressable
        onPress={() => setRole(r)}
        disabled={saving || loading}
        style={({ pressed }) => ({
          flex: 1,
          padding: spacing.lg,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? `${colors.accent}22` : colors.surface,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          gap: 8,
        })}
      >
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <Text style={{ ...text.section, fontSize: 16 }}>{title}</Text>
        <Text style={{ ...text.muted, lineHeight: 18 }}>{subtitle}</Text>

        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: active ? colors.accent : colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {active ? (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}
          </View>
          <Text style={{ ...text.muted, fontSize: 12 }}>{active ? "Selected" : "Tap to select"}</Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ ...text.muted, marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={["rgba(13,148,136,0.22)", "rgba(13,148,136,0.00)"]}
          style={{
            paddingTop: Platform.OS === "android" ? spacing.xl : spacing.xl,
            paddingBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text style={{ ...text.title, fontSize: 28 }}>Choose your role</Text>
          <Text style={{ ...text.muted, marginTop: 8 }}>This helps us customize your experience.</Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <RoleCard
              r="customer"
              title="Customer"
              subtitle="Request a mechanic, track jobs, and pay securely."
              emoji="🧑‍🔧"
            />
            <RoleCard
              r="mechanic"
              title="Mechanic"
              subtitle="Receive jobs, manage requests, and grow your business."
              emoji="🛠️"
            />
          </View>

          <Pressable
            onPress={saveRole}
            disabled={!canContinue}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
              opacity: !canContinue ? 0.55 : pressed ? 0.9 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontWeight: "900", color: "#000", letterSpacing: 0.6 }}>CONTINUE</Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/(auth)/sign-in");
            }}
            disabled={saving}
            style={{ alignSelf: "center", marginTop: 14 }}
          >
            <Text style={{ ...text.muted, textDecorationLine: "underline" }}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
