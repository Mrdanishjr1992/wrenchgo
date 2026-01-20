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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { useOnboarding } from "../../src/onboarding";
import { AppButton } from "../../src/ui/components/AppButton";

type Role = "customer" | "mechanic";

export default function ChooseRole() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();
  const { setUserRole, startWalkthrough, hasSeenCustomerGuide, hasSeenMechanicGuide } = useOnboarding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  const canContinue = useMemo(() => !saving && !loading && !!role, [saving, loading, role]);

  const requireUser = async () => {
    const { data } = await supabase.auth.getSession();
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
        const { data: existingRole } = await supabase.rpc("get_my_role");
        if (existingRole) {
          router.replace("/");
          return;
        }
        if (mounted) setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  const saveRole = async () => {
    try {
      if (!role) return;
      setSaving(true);
      const user = await requireUser();
      if (!user) return;
      const { error } = await supabase.rpc("set_user_role", { new_role: role });
      if (error) throw error;
      await setUserRole(role);
      await sleep(150);
      router.replace("/");
      const hasSeenGuide = role === 'customer' ? hasSeenCustomerGuide : hasSeenMechanicGuide;
      if (!hasSeenGuide) {
        setTimeout(() => { startWalkthrough(role); }, 800);
      }
    } catch (e: any) {
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
    icon,
  }: {
    r: Role;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => {
    const active = role === r;
    return (
      <Pressable
        onPress={() => setRole(r)}
        disabled={saving || loading}
        style={({ pressed }) => ({
          flex: 1,
          padding: spacing.lg,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? `${colors.primary}10` : colors.surface,
          opacity: pressed ? 0.9 : 1,
          gap: spacing.sm,
        })}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: active ? `${colors.primary}20` : `${colors.textMuted}15`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={24} color={active ? colors.primary : colors.textMuted} />
        </View>
        <Text style={[text.section, { fontSize: 16, fontWeight: "700" }]}>{title}</Text>
        <Text style={[text.muted, { fontSize: 13, lineHeight: 18 }]}>{subtitle}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />}
          </View>
          <Text style={[text.muted, { fontSize: 12 }]}>{active ? "Selected" : "Tap to select"}</Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[text.muted, { marginTop: spacing.md }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[text.title, { fontSize: 28, fontWeight: "800", marginBottom: spacing.sm }]}>
            How will you use WrenchGo?
          </Text>
          <Text style={[text.muted, { fontSize: 15, lineHeight: 22 }]}>
            Choose your role to get started. This helps us customize your experience.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
          <RoleCard
            r="customer"
            title="I'm a Customer"
            subtitle="Request a mechanic, track jobs, and pay securely."
            icon="car-outline"
          />
          <RoleCard
            r="mechanic"
            title="I'm a Mechanic"
            subtitle="Find jobs, send offers, and grow your business."
            icon="construct-outline"
          />
        </View>

        <AppButton
          title="Continue"
          onPress={saveRole}
          loading={saving}
          disabled={!canContinue}
          fullWidth
        />

        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace("/(auth)/sign-in");
          }}
          disabled={saving}
          style={{ alignSelf: "center", marginTop: spacing.lg, paddingVertical: spacing.sm }}
        >
          <Text style={[text.muted, { textDecorationLine: "underline" }]}>Sign out instead</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
