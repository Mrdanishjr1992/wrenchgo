import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  FlatList,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { spacing } from "../../../src/ui/theme";
import { createCard, cardPressed } from "../../../src/ui/styles";

type Job = {
  id: string;
  title: string;
  status: string;
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

type EducationCard = {
  id: string;
  symptom_key: string;
  card_key: string;
  title: string;
  summary: string;
  is_it_safe: string;
  order_index: number;
  what_we_check?: string;
  how_quotes_work?: string;
  what_to_prepare?: string;
  quote_strategy?: string;
};

type SymptomMapping = {
  id: string;
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  customer_explainer: string;
};

export default function CustomerHome() {
  const router = useRouter();
  const { colors } = useTheme();

  const textStyles = useMemo(
    () => ({
      title: { fontSize: 24, fontWeight: "900" as const, color: colors.textPrimary },
      section: { fontSize: 16, fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: 14, fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: 13, fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  const card = useMemo(() => createCard(colors), [colors]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [unread, setUnread] = useState(0);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [educationCards, setEducationCards] = useState<EducationCard[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomMapping[]>([]);

  const firstName = useMemo(() => fullName.split(" ")[0] || "", [fullName]);

  const activeJobs = useMemo(() => jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled"), [jobs]);

  const preview = useMemo(() => activeJobs.slice(0, 3), [activeJobs]);

  const quickLabel = useMemo(() => {
    if (activeJobs.length === 0) return "No active jobs";
    if (activeJobs.length === 1) return "1 active job";
    return `${activeJobs.length} active jobs`;
  }, [activeJobs]);

  const statusColor = useCallback(
    (status: string) => {
      if (status === "completed") return "#10b981";
      if (status === "in_progress") return colors.accent;
      if (status === "cancelled") return "#ef4444";
      return colors.textMuted;
    },
    [colors]
  );

  const load = useCallback(async () => {
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const [jobsRes, vehiclesRes, profileRes, inboxRes, eduCardsRes, symptomsRes] = await Promise.all([
        supabase.from("jobs").select("id,title,status,created_at,preferred_time").eq("customer_id", userId).order("created_at", { ascending: false }),
        supabase.from("vehicles").select("id,year,make,model,nickname").eq("customer_id", userId).order("created_at", { ascending: true }),
        supabase.from("profiles").select("full_name").eq("id", userId).single(),
        supabase.from("messages").select("id", { count: "exact", head: false }).eq("recipient_id", userId).eq("read", false),
        supabase.from("education_cards").select("id,symptom_key,card_key,title,summary,is_it_safe,order_index").order("order_index").limit(6),
        supabase.from("symptom_mappings").select("id,symptom_key,symptom_label,category,risk_level,customer_explainer").order("symptom_label").limit(8),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setJobs((jobsRes.data as Job[]) ?? []);
      setVehicles((vehiclesRes.data as Vehicle[]) ?? []);
      setFullName(profileRes.data?.full_name ?? "");
      setUnread(inboxRes.count ?? 0);
      setEducationCards((eduCardsRes.data as EducationCard[]) ?? []);
      setSymptoms((symptomsRes.data as SymptomMapping[]) ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  function StatusPill({ status }: { status: string }) {
    const bg = statusColor(status);
    const label = status.replace(/_/g, " ").toUpperCase();
    return (
      <View style={{ backgroundColor: bg + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "900", color: bg }}>{label}</Text>
      </View>
    );
  }

  function StatCard({ title, value, hint, onPress }: { title: string; value: string; hint: string; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.accent,
            padding: spacing.md,
            gap: 4,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
        <Text style={{ fontSize: 25, fontWeight: "900", color: colors.textPrimary }}>{value}</Text>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted }}>{hint}</Text>
      </Pressable>
    );
  }

  function SectionHeader({ title, rightText, onRightPress, icon }: { title: string; rightText?: string; onRightPress?: () => void; icon?: any }) {
    return (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon && <Image source={icon} style={{ width: 24, height: 24 }} resizeMode="contain" />}
          <Text style={textStyles.title}>{title}</Text>
        </View>
        {rightText && onRightPress && (
          <Pressable onPress={onRightPress}>
            <Text style={{ color: colors.accent, fontWeight: "900" }}>{rightText}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md, borderColor: colors.accent }}  
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <LinearGradient
          colors={[colors.accent + "20", colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.accent +"80",
            borderBottomColor: colors.accent + "40",
            borderTopColor: colors.accent + "40",
            padding: spacing.lg,
            overflow: "hidden",
            marginBottom: spacing.lg,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -60,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: colors.accent + "40",
            }}
          />


          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 62, height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
              <Image source={require("../../../assets/wave.png")} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...textStyles.title, fontSize: 22 }}>{firstName ? `Hey, ${firstName} 👋` : "WrenchGo"}</Text>
              <Text style={{ ...textStyles.muted, marginTop: 4 }}>{quickLabel}</Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
              style={({ pressed }) => [
                {
                  borderRadius: 18,
                  overflow: "hidden",
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                  opacity: pressed ? 0.95 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={[colors.accent , colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: spacing.md,
                  alignItems: "center",
                  borderRadius: 18,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#000", letterSpacing: 0.4 }}>REQUEST A MECHANIC</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/jobs")}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 16,
                  borderRadius: 18,
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <Text style={{ fontWeight: "900", color: colors.textPrimary, letterSpacing: 0.3 }}>VIEW MY JOBS</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
            <StatCard
              title="Active Jobs"
              value={String(activeJobs.length)}
              hint={activeJobs.length ? "Tap to view" : "Start one now"}
              onPress={() => router.push("/(customer)/(tabs)/jobs")}
            />
            <StatCard
              title="Unread Messages"
              value={String(unread)}
              hint={unread ? "Check inbox" : "All caught up"}
              onPress={() => router.push("/(customer)/(tabs)/inbox")}
            />
          </View>
        </LinearGradient>

        <LinearGradient
          colors={[colors.accent + "20", colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.accent +"80",
            borderBottomColor: colors.accent + "40",
            borderTopColor: colors.accent + "40",
            padding: spacing.lg,
            overflow: "hidden",
            marginTop: spacing.lg,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -60,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: colors.accent + "40",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -50,
              bottom: -70,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: colors.accent + "40",
            }}
          />

          <SectionHeader
            title="My Garage"
            rightText="Add"
            onRightPress={() => router.push("/(customer)/garage/add" as any)}
            icon={require("../../../assets/garage.png")}
          />

          {vehicles.length === 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <View style={[card, { padding: spacing.lg }]}>
                <Text style={textStyles.section}>No vehicles yet</Text>
                <Text style={{ marginTop: 6, ...textStyles.muted }}>
                  Add your car to get faster, more accurate quotes.
                </Text>
                <Pressable
                  onPress={() => router.push("/(customer)/garage/add" as any)}
                  style={{
                    marginTop: spacing.md,
                    backgroundColor: colors.accent,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#000" }}>ADD A VEHICLE</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {vehicles.slice(0, 3).map((v) => {
                const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${v.model.split(" ")[0]}&make=${v.make}&modelYear=${v.year}&angle=29`;

                return (
                  <Pressable
                    key={v.id}
                    onPress={() => router.push({
                      pathname: "/(customer)/garage/[id]" as any,
                      params: { id: v.id },
                    })}
                    style={({ pressed }) => [card, pressed && cardPressed, { padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }]}
                  >
                    <View style={{ width: 80, height: 50, borderRadius: 12, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                      <Image
                        source={{ uri: carImageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={textStyles.section}>
                        {v.year} {v.make} {v.model}
                      </Text>
                      {v.nickname ? <Text style={textStyles.muted}>&ldquo;{v.nickname}&rdquo;</Text> : null}
                    </View>
                  </Pressable>
                );
              })}

              {vehicles.length > 3 ? (
                <Pressable onPress={() => router.push("/(customer)/garage" as any)}>
                  <Text style={{ color: colors.accent, fontWeight: "900" }}>View all vehicles →</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </LinearGradient>

        <LinearGradient
          colors={[colors.surface, colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.accent +"80",
            borderBottomColor: colors.accent + "40",
            borderTopColor: colors.accent + "40",
            padding: spacing.lg,
            overflow: "hidden",
            marginTop: spacing.lg,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -60,
              bottom: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: colors.accent + "40",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -50,
              top: -70,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: colors.accent + "25",
            }}
          />

          <SectionHeader
            title="Car Care Tips"
            rightText="View All"
            onRightPress={() => router.push("/(customer)/education")}
            icon={require("../../../assets/garage.png")}
          />

          <Text style={{ ...textStyles.section, marginTop: spacing.sm }}>
            Learn about common car issues and what to do
          </Text>

          {symptoms.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, marginTop: spacing.md, paddingRight: spacing.md }}
            >
              {symptoms.slice(0, 4).map((symptom) => {
                const riskColor = symptom.risk_level === "high" ? "#ef4444" : symptom.risk_level === "medium" ? "#f59e0b" : "#10b981";
                return (
                  <Pressable
                    key={symptom.id}
                    onPress={() => router.push("/(customer)/education")}
                    style={({ pressed }) => [
                      card,
                      pressed && cardPressed,
                      {
                        width: 280,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
                      <Text style={{ ...textStyles.section, flex: 1 }} numberOfLines={1}>{symptom.symptom_label}</Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: riskColor + "22",
                          marginLeft: spacing.xs,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "900", color: riskColor }}>
                          {symptom.risk_level.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ ...textStyles.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                      {symptom.customer_explainer}
                    </Text>
                    <View
                      style={{
                        marginTop: spacing.sm,
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 12 }}>
                        Learn more →
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <View style={[card, { padding: spacing.lg }]}>
                <Text style={textStyles.muted}>Loading car care tips...</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <LinearGradient
          colors={[colors.surface, colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.accent +"80",
            borderBottomColor: colors.accent + "40",
            borderTopColor: colors.accent + "40",
            padding: spacing.lg,
            overflow: "hidden",
            marginTop: spacing.lg,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -60,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: colors.accent + "30",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -50,
              bottom: -70,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: colors.accent + "20",
            }}
          />

          <SectionHeader
            title="What to Know"
            rightText="See All"
            onRightPress={() => router.push("/(customer)/education")}
          />

          <Text style={{ ...textStyles.section, marginTop: spacing.sm }}>
            Educational guides to help you understand your car better
          </Text>

          {educationCards.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {educationCards.slice(0, 3).map((eduCard) => {
                const safetyColor = eduCard.is_it_safe.toLowerCase().includes("safe") ? "#10b981" : eduCard.is_it_safe.toLowerCase().includes("not") ? "#ef4444" : "#f59e0b";
                return (
                  <Pressable
                    key={eduCard.id}
                    onPress={() => router.push("/(customer)/education")}
                    style={({ pressed }) => [
                      card,
                      pressed && cardPressed,
                      {
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.xs }}>
                      <Text style={{ ...textStyles.section, flex: 1 }}>{eduCard.title}</Text>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: safetyColor,
                        }}
                      />
                    </View>
                    <Text style={{ ...textStyles.muted, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm }} numberOfLines={2}>
                      {eduCard.summary}
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.accent + "15", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.accent }}>✅ What we&apos;ll check</Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: safetyColor + "15", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: safetyColor }}>🛟 Is it safe?</Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.textMuted + "15", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>💵 How quotes work</Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 12 }}>
                        Learn more →
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <View style={[card, { padding: spacing.lg }]}>
                <Text style={textStyles.muted}>Loading educational content...</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </ScrollView>

    </View>
  );
}
