import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../src/ui/theme-context";
import { supabase } from "../../../src/lib/supabase";
import { createCard } from "../../../src/ui/styles";

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  preferred_time: string | null;
};

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

export default function CustomerHome() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const card = useMemo(() => createCard(colors), [colors]);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [unread, setUnread] = useState(0);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = useMemo(() => (fullName.split(" ")[0] || "").trim(), [fullName]);

  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      const s = (j.status || "").toLowerCase();
      return s !== "completed" && s !== "canceled";
    });
  }, [jobs]);

  const bootstrapUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const uid = data.session?.user?.id ?? null;
      if (!uid) {
        router.replace("/(auth)/sign-in");
        return;
      }
      setCustomerId(uid);
    } catch (e: any) {
      console.warn("bootstrapUser error:", e?.message ?? e);
      router.replace("/(auth)/sign-in");
    }
  }, [router]);

  useEffect(() => {
    bootstrapUser();
  }, [bootstrapUser]);

  const fetchData = useCallback(async () => {
    if (!customerId) return;
    try {
      const [jobsRes, vehiclesRes, profileRes, unreadRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id,title,status,created_at,preferred_time")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicles")
          .select("id,year,make,model,nickname")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", customerId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id, job_id, jobs!inner(customer_id)", { count: "exact", head: true })
          .eq("jobs.customer_id", customerId)
          .is("read_at", null)
          .neq("sender_id", customerId),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (profileRes.error) throw profileRes.error;
      if (unreadRes.error) throw unreadRes.error;

      setJobs((jobsRes.data as Job[]) ?? []);
      setVehicles((vehiclesRes.data as Vehicle[]) ?? []);
      setFullName(profileRes.data?.full_name ?? "");
      setUnread(unreadRes.count ?? 0);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    fetchData();
  }, [customerId, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ ...text.muted, fontSize: 14 }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </Text>
          <Text style={{ ...text.title, fontSize: 28, marginTop: 4 }}>
            {firstName ? `Hey, ${firstName}` : "Welcome back"}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
          style={({ pressed }) => [
            card,
            {
              padding: spacing.lg,
              backgroundColor: colors.accent,
              borderColor: colors.accent,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="construct" size={24} color="#fff" />
            </View>
            <View>
              <Text style={{ fontWeight: "900", color: "#fff", fontSize: 18 }}>Request a Mechanic</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 }}>
                Get help with your car today
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </Pressable>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/jobs" as any)}
            style={({ pressed }) => [
              card,
              { flex: 1, padding: spacing.md },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: `${colors.accent}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="briefcase-outline" size={18} color={colors.accent} />
              </View>
              <Text style={{ ...text.muted, fontSize: 12, fontWeight: "800" }}>ACTIVE JOBS</Text>
            </View>
            <Text style={{ ...text.title, fontSize: 32 }}>{activeJobs.length}</Text>
            <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
              {activeJobs.length === 0 ? "No active jobs" : "Tap to view"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/inbox" as any)}
            style={({ pressed }) => [
              card,
              { flex: 1, padding: spacing.md },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: unread > 0 ? "#EF444415" : `${colors.accent}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={unread > 0 ? "mail-unread-outline" : "mail-outline"}
                  size={18}
                  color={unread > 0 ? "#EF4444" : colors.accent}
                />
              </View>
              <Text style={{ ...text.muted, fontSize: 12, fontWeight: "800" }}>MESSAGES</Text>
            </View>
            <Text style={{ ...text.title, fontSize: 32, color: unread > 0 ? "#EF4444" : colors.textPrimary }}>
              {unread}
            </Text>
            <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
              {unread === 0 ? "All caught up" : "Unread messages"}
            </Text>
          </Pressable>
        </View>

        <View style={[card, { padding: spacing.md }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="car-outline" size={18} color={colors.textPrimary} />
              </View>
              <Text style={text.section}>My Garage</Text>
            </View>
            <Pressable onPress={() => router.push("/(customer)/garage/add" as any)}>
              <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 14 }}>+ Add</Text>
            </Pressable>
          </View>

          {vehicles.length === 0 ? (
            <Pressable
              onPress={() => router.push("/(customer)/garage/add" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.lg,
                  alignItems: "center",
                  gap: spacing.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={40} color={colors.textMuted} />
              <Text style={{ ...text.body, fontWeight: "800" }}>Add your first vehicle</Text>
              <Text style={{ ...text.muted, fontSize: 13, textAlign: "center" }}>
                Get faster, more accurate quotes
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {vehicles.slice(0, 3).map((vehicle) => {
                const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${encodeURIComponent(
                  vehicle.model.split(" ")[0] || vehicle.model
                )}&make=${encodeURIComponent(vehicle.make)}&modelYear=${encodeURIComponent(
                  String(vehicle.year)
                )}&angle=29`;

                return (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => router.push({ pathname: "/(customer)/garage/[id]" as any, params: { id: vehicle.id } })}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: spacing.sm,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <View
                      style={{
                        width: 70,
                        height: 45,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        overflow: "hidden",
                      }}
                    >
                      <Image source={{ uri: carImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...text.body, fontWeight: "800" }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                      {vehicle.nickname && (
                        <Text style={{ ...text.muted, fontSize: 12 }}>"{vehicle.nickname}"</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                );
              })}
              {vehicles.length > 3 && (
                <Pressable onPress={() => router.push("/(customer)/garage" as any)}>
                  <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 14, textAlign: "center", marginTop: 4 }}>
                    View all {vehicles.length} vehicles
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={[card, { padding: spacing.md }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.textPrimary} />
            </View>
            <Text style={text.section}>Quick Help</Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#EF444415",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="warning-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "800" }}>Car won't start?</Text>
                <Text style={{ ...text.muted, fontSize: 12 }}>Get roadside help fast</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#F59E0B15",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="speedometer-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "800" }}>Check engine light on?</Text>
                <Text style={{ ...text.muted, fontSize: 12 }}>Diagnose the issue</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#10B98115",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="build-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "800" }}>Regular maintenance</Text>
                <Text style={{ ...text.muted, fontSize: 12 }}>Oil change, brakes & more</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
