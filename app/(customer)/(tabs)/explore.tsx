import React, { useCallback, useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Image, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { VehicleChip } from "../../../src/components/VehicleChip";
import { VehiclePickerDrawer } from "../../../src/components/VehiclePickerDrawer";
import { RiskBadge } from "../../../src/components/RiskBadge";
import { useSymptoms } from "../../../src/hooks/use-symptoms";
import { useServiceAreaByCoords } from "../../../src/hooks/useServiceArea";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

function ServiceAreaBanner({
  allowed,
  message,
  hubName,
  boundaryStatus,
}: {
  allowed: boolean;
  message?: string;
  hubName?: string;
  boundaryStatus?: string;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  if (allowed) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: withAlpha(colors.success, 0.1),
        }}
      >
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: withAlpha(colors.success, 0.2),
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 14,
            fontWeight: "700",
            color: colors.success,
          }}>{message || `You're in our ${hubName || "service"} area!`}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: withAlpha(colors.warning, 0.1),
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: withAlpha(colors.warning, 0.2),
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Ionicons name="location" size={22} color={colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 14,
          fontWeight: "700",
          color: colors.warning,
          marginBottom: 2,
        }}>
          {boundaryStatus === "future_ring" ? "Expanding to your area soon!" : "Not in service area yet"}
        </Text>
        <Text style={{
          fontSize: 13,
          color: colors.textMuted,
        }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

function StepIndicator({ step, label }: { step: number; label: string }) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    }}>
      <View style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Text style={{
          fontSize: 14,
          fontWeight: "800",
          color: colors.white,
        }}>{step}</Text>
      </View>
      <Text style={{
        fontSize: 13,
        fontWeight: "700",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}>{label}</Text>
    </View>
  );
}

function VehicleSelector({
  vehicle,
  vehicles,
  loading,
  onPress,
}: {
  vehicle: Vehicle | null;
  vehicles: Vehicle[];
  loading: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (vehicle) {
    return (
      <VehicleChip
        year={String(vehicle.year)}
        make={vehicle.make}
        model={vehicle.model}
        nickname={vehicle.nickname || undefined}
        onPress={onPress}
      />
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: colors.primary,
          borderStyle: "dashed",
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 56,
          height: 56,
          borderRadius: radius.xl,
          backgroundColor: withAlpha(colors.primary, 0.1),
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Ionicons name="car" size={28} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: 2,
          }}>Select your vehicle</Text>
          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
          }}>Choose which car needs service</Text>
          {vehicles.length === 0 && !loading && (
            <Text style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: "600",
              color: colors.primary,
            }}>No vehicles yet — tap to add one</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </AnimatedPressable>
    </Animated.View>
  );
}

function WrenchIntro() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(150).duration(300)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.lg,
        backgroundColor: withAlpha(colors.primary, 0.06),
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, 0.15),
      }}
    >
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        }}>Hey there! I'm Wrench.</Text>
        <Text style={{
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 20,
        }}>Pick the symptom that best matches what you're experiencing — we'll ask a couple quick questions next.</Text>
      </View>
      <Image
        source={require("../../../assets/wrench.png")}
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

function CategoryHeader({
  category,
  count,
  isCollapsed,
  onToggle,
}: {
  category: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onToggle}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={[animatedStyle, {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        marginBottom: isCollapsed ? 0 : spacing.sm,
        borderRadius: radius.lg,
      }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.textPrimary,
        }}>{category}</Text>
        <View style={{
          backgroundColor: withAlpha(colors.primary, 0.1),
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: radius.full,
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.primary,
          }}>{count}</Text>
        </View>
      </View>
      <Ionicons
        name={isCollapsed ? "chevron-forward" : "chevron-down"}
        size={18}
        color={colors.textMuted}
      />
    </AnimatedPressable>
  );
}

function SymptomCard({
  symptom,
  disabled,
  onPress,
  index,
}: {
  symptom: SymptomItem;
  disabled: boolean;
  onPress: () => void;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const risk = normalizeRiskLevel(symptom.risk_level);
  const icon = symptom.icon || fallbackSymptomIcon(symptom.symptom_key);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          opacity: disabled ? 0.6 : 1,
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 48,
          height: 48,
          borderRadius: radius.lg,
          backgroundColor: withAlpha(colors.primary, 0.1),
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginBottom: 2,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.textPrimary,
              flex: 1,
            }} numberOfLines={1}>
              {symptom.symptom_label}
            </Text>
            {(risk === "high" || risk === "medium") && <RiskBadge riskLevel={risk} size="small" />}
          </View>

          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
          }} numberOfLines={2}>
            {symptom.customer_explainer ?? ""}
          </Text>

          {disabled && (
            <Text style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: "600",
              color: colors.primary,
            }}>Select a vehicle first</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </AnimatedPressable>
    </Animated.View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
    borderRadius: radius.md,
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[shimmer, { height: 60, borderRadius: radius.xl }]} />
      <View style={[shimmer, { height: 100, borderRadius: radius.xl }]} />
      <View style={[shimmer, { height: 80, borderRadius: radius.xl }]} />
      <View style={[shimmer, { height: 80, borderRadius: radius.xl }]} />
      <View style={[shimmer, { height: 80, borderRadius: radius.xl }]} />
    </View>
  );
}

function EmptyState({ onRetry }: { onRetry?: () => void }) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={{
        alignItems: "center",
        padding: spacing.xl,
      }}
    >
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: withAlpha(colors.warning, 0.1),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="search" size={36} color={colors.warning} />
      </View>

      <Text style={{
        fontSize: 18,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.xs,
      }}>No symptoms available</Text>

      <Text style={{
        fontSize: 14,
        color: colors.textMuted,
        textAlign: "center",
        marginBottom: spacing.lg,
      }}>Please try again later or contact support.</Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.xl,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{
            fontSize: 15,
            fontWeight: "700",
            color: colors.white,
          }}>Retry</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export default function Explore() {
  const router = useRouter();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const serviceArea = useServiceAreaByCoords(userLocation?.lat ?? null, userLocation?.lng ?? null);
  const { symptoms, loading: loadingSymptoms, error: symptomsError, refetch } = useSymptoms();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

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

    (symptoms ?? []).forEach((symptom: any) => {
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
  }, [symptoms]);

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

      if (list.length === 1 && !selectedVehicleId) {
        setSelectedVehicleId(list[0].id);
        setSelectedVehicle(list[0]);
      }

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Explore",
          headerStyle: { backgroundColor: colors.bg },
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingLeft: spacing.lg + insets.left,
          paddingRight: spacing.lg + insets.right,
          paddingBottom: spacing.xxxl + insets.bottom,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!serviceArea.loading && userLocation && (
          <ServiceAreaBanner
            allowed={serviceArea.allowed}
            message={serviceArea.message}
            hubName={serviceArea.hubName ?? undefined}
            boundaryStatus={serviceArea.boundaryStatus}
          />
        )}

        <View>
          <StepIndicator step={1} label="Select Vehicle" />
          <VehicleSelector
            vehicle={selectedVehicle}
            vehicles={vehicles}
            loading={loadingVehicles}
            onPress={handleChangeVehicle}
          />
        </View>

        <WrenchIntro />

        <View>
          <StepIndicator step={2} label="Choose Symptom" />

          {loadingSymptoms ? (
            <LoadingSkeleton />
          ) : symptomsError ? (
            <EmptyState onRetry={refetch} />
          ) : !symptoms || symptoms.length === 0 || categoryGroups.length === 0 ? (
            <EmptyState onRetry={refetch} />
          ) : (
            <View style={{ gap: spacing.md }}>
              {categoryGroups.map((group, groupIndex) => {
                const isCollapsed = collapsedCategories.has(group.category);

                return (
                  <Animated.View
                    key={group.category}
                    entering={FadeInDown.delay(groupIndex * 50).duration(300)}
                  >
                    <CategoryHeader
                      category={group.category}
                      count={group.symptoms.length}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleCategory(group.category)}
                    />

                    {!isCollapsed && (
                      <View>
                        {group.symptoms.map((symptom, index) => (
                          <SymptomCard
                            key={symptom.symptom_key}
                            symptom={symptom}
                            disabled={!selectedVehicleId || !selectedVehicle}
                            onPress={() => handleSymptomSelect(symptom.symptom_key)}
                            index={index}
                          />
                        ))}
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
