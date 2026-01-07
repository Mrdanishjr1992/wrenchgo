import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { spacing } from "../../../src/ui/theme";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { VehicleChip } from "../../../src/components/VehicleChip";
import { VehiclePickerDrawer } from "../../../src/components/VehiclePickerDrawer";
import { RiskBadge } from "../../../src/components/RiskBadge";
import { useSymptoms } from "../../../src/hooks/use-symptoms";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type SymptomItem = {
  symptom_key: string;
  symptom_label: string;
  customer_explainer: string;
  risk_level: string;
  icon?: string | null;
};

type CategoryGroup = {
  category: string;
  symptoms: SymptomItem[];
  highestRiskLevel: "high" | "medium" | "low";
};

function normalizeRiskLevel(risk: unknown): "high" | "medium" | "low" {
  const v = String(risk ?? "").toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

function getHighestRiskLevel(symptoms: { risk_level: string }[]): "high" | "medium" | "low" {
  const levels = symptoms.map((s) => normalizeRiskLevel(s.risk_level));
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

// If DB doesn't return icon (common when symptoms/icon isn't joined), this keeps UI pretty.
function fallbackSymptomIcon(symptomKey: string): string {
  const map: Record<string, string> = {
    wont_start: "🚨",
    warning_light: "🔔",
    brakes_wrong: "🛑",
    strange_noise: "🔊",
    fluid_leak: "💧",
    battery_issues: "🔋",
    maintenance: "🧰",
    not_sure: "❓",
  };
  return map[symptomKey] ?? "🛠️";
}

export default function Explore() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const card = useMemo(() => createCard(colors), [colors]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const { symptoms, loading: loadingSymptoms, error: symptomsError, refetch } = useSymptoms();

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const grouped: Record<string, CategoryGroup> = {};

    // Filter symptoms by search query
    const filteredSymptoms = (symptoms ?? []).filter((symptom: any) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const label = (symptom.symptom_label ?? "").toLowerCase();
      const explainer = (symptom.customer_explainer ?? "").toLowerCase();
      const category = (symptom.category ?? "").toLowerCase();

      return label.includes(query) || explainer.includes(query) || category.includes(query);
    });

    filteredSymptoms.forEach((symptom: any) => {
      const category = symptom.category || "Other";

      if (!grouped[category]) {
        grouped[category] = { category, symptoms: [], highestRiskLevel: "low" };
      }

      grouped[category].symptoms.push({
        symptom_key: symptom.symptom_key,
        symptom_label: symptom.symptom_label,
        customer_explainer: symptom.customer_explainer,
        risk_level: symptom.risk_level ?? "low",
        icon: symptom.icon ?? null,
      });
    });

    Object.values(grouped).forEach((group) => {
      group.highestRiskLevel = getHighestRiskLevel(group.symptoms);
    });

    const riskOrder = { high: 0, medium: 1, low: 2 } as const;

    return Object.values(grouped).sort((a, b) => {
      const diff = riskOrder[a.highestRiskLevel] - riskOrder[b.highestRiskLevel];
      if (diff !== 0) return diff;
      return a.category.localeCompare(b.category);
    });
  }, [symptoms, searchQuery]);

  const loadVehicles = useCallback(async () => {
    try {
      setLoadingVehicles(true);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) {
        setVehicles([]);
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data as Vehicle[]) ?? [];
      setVehicles(list);

      // Auto-select if exactly one vehicle and none selected yet
      if (list.length === 1 && !selectedVehicleId) {
        setSelectedVehicleId(list[0].id);
        setSelectedVehicle(list[0]);
      }

      // If previously selected vehicle no longer exists
      if (selectedVehicleId && !list.some((v) => v.id === selectedVehicleId)) {
        setSelectedVehicleId(null);
        setSelectedVehicle(null);
      }
    } catch (e: any) {
      console.error("Failed to load vehicles:", e?.message ?? e);
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  }, [selectedVehicleId]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadVehicles(), refetch()]);
    setRefreshing(false);
  }, [loadVehicles, refetch]);

  const handleSelectVehicle = useCallback((vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicle(vehicle);
    setShowVehicleDrawer(false);
  }, []);

  const handleChangeVehicle = useCallback(() => {
    setShowVehicleDrawer(true);
  }, []);

  const handleSymptomSelect = useCallback(
    (symptomKey: string) => {
      if (!selectedVehicleId || !selectedVehicle) {
        setShowVehicleDrawer(true);
        return;
      }

      router.push({
        pathname: "/(customer)/request-service" as any,
        params: {
          symptom: symptomKey,
          vehicleId: selectedVehicleId,
          vehicleYear: String(selectedVehicle.year),
          vehicleMake: selectedVehicle.make,
          vehicleModel: selectedVehicle.model,
          vehicleNickname: selectedVehicle.nickname || "",
        },
      });
    },
    [router, selectedVehicle, selectedVehicleId]
  );

  const stepPill = (label: string) => (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textMuted }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Explore",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      <VehiclePickerDrawer
        visible={showVehicleDrawer}
        onClose={() => setShowVehicleDrawer(false)}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelect={handleSelectVehicle}
        onAddNew={() => setShowVehicleDrawer(false)}
        loading={loadingVehicles}
        returnTo="explore"
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingLeft: spacing.lg + insets.left,
          paddingRight: spacing.lg + insets.right,
          paddingBottom: spacing.lg + insets.bottom,
          gap: spacing.md,
        }}
      >
        {/* Step 1: Vehicle */}
        {stepPill("STEP 1")}
        {selectedVehicle ? (
          <VehicleChip
            year={String(selectedVehicle.year)}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={handleChangeVehicle}
          />
        ) : (
          <Pressable
            onPress={handleChangeVehicle}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: colors.accent + "25",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 32 }}>🚗</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.textPrimary, marginBottom: 2 }}>
                Select your vehicle
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                Choose which car needs service
              </Text>
              {vehicles.length === 0 && !loadingVehicles && (
                <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: colors.accent }}>
                  No vehicles yet — tap to add one
                </Text>
              )}
            </View>

            <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
          </Pressable>
        )}

        {/* Wrench Intro */}
        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 14,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "80",
            position: "relative",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs }}>
            Hey there! I&apos;m Wrench.
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, lineHeight: 20 }}>
            Pick the symptom that best matches what you’re experiencing — we’ll ask a couple quick questions next.
          </Text>
          <Image
            source={require("../../../assets/wrench.png")}
            style={{ width: 64, height: 64, position: "absolute", right: 8, top: "50%", marginTop: -32 }}
            resizeMode="contain"
          />
        </View>

        {/* Step 2: Symptom */}
        {stepPill("STEP 2")}

        {/* Search Bar */}
        {!loadingSymptoms && !symptomsError && symptoms.length > 0 && (
          <View
            style={[
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              },
            ]}
          >
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search symptoms..."
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "600",
                color: colors.textPrimary,
                padding: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Text style={{ fontSize: 18, color: colors.textMuted }}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {loadingSymptoms ? (
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ marginTop: spacing.md, color: colors.textMuted, fontWeight: "700" }}>
              Loading symptoms...
            </Text>
          </View>
        ) : symptomsError ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>⚠️</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginBottom: spacing.xs }}>
              Couldn’t load symptoms
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textMuted,
                textAlign: "center",
                marginBottom: spacing.md,
              }}
            >
              {String(symptomsError)}
            </Text>
            <Pressable
              onPress={refetch}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: 10,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Retry</Text>
            </Pressable>
          </View>
        ) : !symptoms || symptoms.length === 0 ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>❓</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginBottom: spacing.xs }}>
              No symptoms available
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, textAlign: "center" }}>
              Please contact support if this keeps happening.
            </Text>
          </View>
        ) : categoryGroups.length === 0 ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>🔍</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginBottom: spacing.xs }}>
              No symptoms found
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, textAlign: "center" }}>
              Try a different search term or clear the search to see all symptoms.
            </Text>
            <Pressable
              onPress={() => setSearchQuery("")}
              style={({ pressed }) => [
                {
                  marginTop: spacing.md,
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: 10,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Clear Search</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {categoryGroups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.category);

              return (
                <View key={group.category} style={{ marginBottom: spacing.lg }}>
                  <Pressable
                    onPress={() => toggleCategory(group.category)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: isCollapsed ? 0 : spacing.sm,
                        padding: spacing.sm,
                        borderRadius: 10,
                        backgroundColor: pressed ? colors.surface2 : "transparent",
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary }}>
                        {group.category}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: colors.accent + "15",
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "800", color: colors.accent }}>
                          {(group.symptoms ?? []).length}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 18,
                        color: colors.textMuted,
                        transform: [{ rotate: isCollapsed ? "0deg" : "90deg" }],
                      }}
                    >
                      ›
                    </Text>
                  </Pressable>

                  {!isCollapsed && (
                    <>
                      {(group.symptoms ?? []).map((symptom) => {
                        const risk = normalizeRiskLevel(symptom.risk_level);
                        const icon = symptom.icon || fallbackSymptomIcon(symptom.symptom_key);

                        const disabled = !selectedVehicleId || !selectedVehicle;

                        return (
                          <Pressable
                            key={symptom.symptom_key}
                            onPress={() => handleSymptomSelect(symptom.symptom_key)}
                            disabled={disabled}
                            style={({ pressed }) => [
                              card,
                              pressed && !disabled && cardPressed,
                              {
                                padding: spacing.md,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: spacing.md,
                                marginBottom: spacing.sm,
                                opacity: disabled ? 0.6 : 1,
                              },
                            ]}
                          >
                            <View
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: colors.accent + "12",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ fontSize: 22 }}>{icon}</Text>
                            </View>

                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 }}>
                                <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                                  {symptom.symptom_label}
                                </Text>
                                {(risk === "high" || risk === "medium") && <RiskBadge riskLevel={risk} size="small" />}
                              </View>

                              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }} numberOfLines={2}>
                                {symptom.customer_explainer ?? ""}
                              </Text>

                              {disabled && (
                                <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: colors.accent }}>
                                  Select a vehicle first
                                </Text>
                              )}
                            </View>

                            <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
                          </Pressable>
                        );
                      })}
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
