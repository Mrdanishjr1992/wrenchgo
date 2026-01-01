import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { spacing } from "../../../src/ui/theme";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { VehicleChip } from "../../../src/components/VehicleChip";
import { VehiclePickerDrawer } from "../../../src/components/VehiclePickerDrawer";
import { CollapsibleCategorySection } from "../../../src/components/CollapsibleCategorySection";
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
  risk_level: string; // assume string but guard in code anyway
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

function getDefaultExpandedCategory(categoryGroups: CategoryGroup[]): string | null {
  if (categoryGroups.length === 0) return null;
  const high = categoryGroups.find((g) => g.highestRiskLevel === "high");
  return high?.category ?? categoryGroups[0].category;
}

export default function Explore() {
  const router = useRouter();
  const { colors } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const { symptoms, loading: loadingSymptoms, error: symptomsError, refetch } = useSymptoms();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [didSetDefaultExpanded, setDidSetDefaultExpanded] = useState(false);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const grouped: Record<string, CategoryGroup> = {};

    (symptoms ?? []).forEach((symptom: any) => {
      const category = symptom.category || "Other";

      if (!grouped[category]) {
        grouped[category] = {
          category,
          symptoms: [],
          highestRiskLevel: "low",
        };
      }

      grouped[category].symptoms.push({
        symptom_key: symptom.symptom_key,
        symptom_label: symptom.symptom_label,
        customer_explainer: symptom.customer_explainer,
        risk_level: symptom.risk_level ?? "low",
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
  }, [symptoms]);

  // Set default expanded category once after symptoms load
  useEffect(() => {
    if (didSetDefaultExpanded) return;
    if (categoryGroups.length === 0) return;

    const defaultCategory = getDefaultExpandedCategory(categoryGroups);
    if (defaultCategory) {
      setExpandedCategories(new Set([defaultCategory]));
    }
    setDidSetDefaultExpanded(true);
  }, [categoryGroups, didSetDefaultExpanded]);

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

  // If user selects vehicle from drawer, persist it
  const handleSelectVehicle = useCallback((vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicle(vehicle);
    setShowVehicleDrawer(false);
  }, []);

  const handleChangeVehicle = useCallback(() => {
    setShowVehicleDrawer(true);
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
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
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        {/* Vehicle Selection */}
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
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 2 }}>
                Select Your Vehicle
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                Choose which car needs service
              </Text>
              {vehicles.length === 0 && !loadingVehicles && (
                <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "700", color: colors.accent }}>
                  No vehicles yet — tap to add one
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
          </Pressable>
        )}

        {/* Wrench Introduction */}
        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "80",
            position: "relative",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs }}>
            Hey there! I&apos;m Wrench, your car care buddy.
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, lineHeight: 20 }}>
            Tell me what&apos;s going on with your car, and I&apos;ll connect you with trusted mechanics nearby.
          </Text>
          <Image
            source={require("../../../assets/wrench.png")}
            style={{
              width: 64,
              height: 64,
              position: "absolute",
              right: 8,
              top: "50%",
              marginTop: -32,
            }}
            resizeMode="contain"
          />
        </View>

        {/* Symptoms states */}
        {loadingSymptoms ? (
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ marginTop: spacing.md, color: colors.textMuted, fontWeight: "600" }}>
              Loading symptoms...
            </Text>
          </View>
        ) : symptomsError ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>⚠️</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.textPrimary,
                marginBottom: spacing.xs,
                textAlign: "center",
              }}
            >
              Failed to load symptoms
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
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Retry</Text>
            </Pressable>
          </View>
        ) : !symptoms || symptoms.length === 0 ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 32, marginBottom: spacing.md }}>❓</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.textPrimary,
                marginBottom: spacing.xs,
                textAlign: "center",
              }}
            >
              No symptoms available
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, textAlign: "center" }}>
              Please contact support if this issue persists.
            </Text>
          </View>
        ) : (
          categoryGroups.map((group) => (
            <CollapsibleCategorySection
              key={group.category}
              category={group.category}
              symptomCount={group.symptoms.length}
              isExpanded={expandedCategories.has(group.category)}
              onToggle={() => toggleCategory(group.category)}
            >
              {group.symptoms.map((symptom) => {
                const risk = normalizeRiskLevel(symptom.risk_level);

                return (
                  <Pressable
                    key={symptom.symptom_key}
                    onPress={() => handleSymptomSelect(symptom.symptom_key)}
                    style={({ pressed }) => [
                      card,
                      pressed && cardPressed,
                      {
                        padding: spacing.md,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                          {symptom.symptom_label}
                        </Text>
                        {(risk === "high" || risk === "medium") && <RiskBadge riskLevel={risk} size="small" />}
                      </View>

                      <Text
                        style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}
                        numberOfLines={2}
                      >
                        {symptom.customer_explainer}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
                  </Pressable>
                );
              })}
            </CollapsibleCategorySection>
          ))
        )}
      </ScrollView>
    </View>
  );
}
