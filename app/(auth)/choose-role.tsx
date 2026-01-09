// /app/(auth)/choose-role.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { useOnboarding } from "../../src/onboarding";

type Role = "customer" | "mechanic";

export default function ChooseRole() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const { setUserRole, startWalkthrough, hasSeenCustomerGuide, hasSeenMechanicGuide } = useOnboarding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  const canContinue = useMemo(() => !saving && !loading && !!role, [saving, loading, role]);

  const requireUser = async () => {
    const { data, error } = await supabase.auth.getSession();

    const user = data.session?.user;
    if (!user) {
      router.replace("/(auth)/sign-in");
      return null;
    }
    return user;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);

        const user = await requireUser();
        if (!user) return;

        // Use RPC to check role (bypasses RLS)
        const { data: existingRole, error: roleErr } = await supabase.rpc("get_my_role");

        if (existingRole) {
          router.replace("/");
          return;
        }

        if (mounted) setLoading(false);
      } catch (e: any) {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRole = async () => {
    try {
      if (!role) return;

      setSaving(true);

      const user = await requireUser();
      if (!user) return;

      // Call your SECURITY DEFINER RPC so RLS can stay strict
      const { error } = await supabase.rpc("set_user_role", { new_role: role });
      if (error) throw error;

      // Save role to onboarding storage
      await setUserRole(role);

      // Small delay helps if downstream screens fetch mechanic_profiles immediately
      await sleep(150);

      // Navigate to the appropriate tab group
      router.replace("/");

      // Start walkthrough if user hasn't seen it yet
      const hasSeenGuide = role === 'customer' ? hasSeenCustomerGuide : hasSeenMechanicGuide;
      if (!hasSeenGuide) {
        // Small delay to let the screen mount first
        setTimeout(() => {
          startWalkthrough(role);
        }, 800);
      }
    } catch (e: any) {
      // Make "already set" friendlier if your RPC throws that message
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("role already set")) {
        Alert.alert("Role already set", "Your role is already chosen. Continuing…");
        router.replace("/");
        return;
      }

      Alert.alert("Couldn't save role", e?.message ?? "Try again.");
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
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        accessibilityLabel={`${title}. ${subtitle}`}
        style={({ pressed }) => ({
          flex: 1,
          padding: spacing.lg,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? `${colors.accent}22` : colors.surface,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          gap: 8,
        })}
      >
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
        <Text style={{ ...text.section, fontSize: 17, fontWeight: '700' }}>{title}</Text>
        <Text style={{ ...text.muted, lineHeight: 20, fontSize: 14 }}>{subtitle}</Text>

        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: active ? colors.accent : colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.accent : 'transparent',
            }}
          >
            {active && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                }}
              />
            )}
          </View>
          <Text style={{ ...text.muted, fontSize: 13 }}>
            {active ? "Selected" : "Tap to select"}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ ...text.muted, marginTop: 12 }}>Loading…</Text>
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
          colors={[`${colors.accent}22`, `${colors.accent}00`]}
          style={{
            paddingTop: spacing.xl + 20,
            paddingBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text style={{ ...text.title, fontSize: 30, fontWeight: '800' }}>
            How will you use WrenchGo?
          </Text>
          <Text style={{ ...text.muted, marginTop: 10, fontSize: 16, lineHeight: 22 }}>
            Choose your role to get started. This helps us customize your experience.
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <RoleCard
              r="customer"
              title="I'm a Customer"
              subtitle="Request a mechanic, track jobs, and pay securely."
              emoji="🚗"
            />
            <RoleCard
              r="mechanic"
              title="I'm a Mechanic"
              subtitle="Find jobs, send offers, and grow your business."
              emoji="🔧"
            />
          </View>

          <Pressable
            onPress={saveRole}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !canContinue }}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
              backgroundColor: colors.accent,
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: "center",
              opacity: !canContinue ? 0.5 : pressed ? 0.9 : 1,
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: canContinue ? 0.3 : 0,
              shadowRadius: 8,
              elevation: canContinue ? 4 : 0,
            })}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontWeight: "800", color: "#fff", fontSize: 16, letterSpacing: 0.5 }}>
                Continue
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/(auth)/sign-in");
            }}
            disabled={saving}
            style={{ alignSelf: "center", marginTop: 16, paddingVertical: 8 }}
          >
            <Text style={{ ...text.muted, textDecorationLine: "underline", fontSize: 14 }}>
              Sign out instead
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
