import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

export default function GarageIndex() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const normalizeReturnTo = (returnTo: string | string[] | undefined): string => {
    if (!returnTo) return "/(customer)/(tabs)/explore";
    const normalized = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    const allowedPaths: Record<string, string> = {
      "explore": "/(customer)/(tabs)/explore",
      "request-service": "/(customer)/request-service",
    };
    return allowedPaths[normalized] || "/(customer)/(tabs)/explore";
  };

  const returnToNormalized = useMemo(() => {
    if (!params.returnTo) return undefined;
    return Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  }, [params.returnTo]);

  const isSelectMode = returnToNormalized === "request-service" || returnToNormalized === "explore";

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setVehicles((data as Vehicle[]) ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  }, [loadVehicles]);

  const handleSelectVehicle = (vehicle: Vehicle) => {
    const returnToPath = normalizeReturnTo(params.returnTo);

    if (isSelectMode) {
      router.replace({
        pathname: returnToPath as any,
        params: {
          vehicleId: vehicle.id,
          vehicleYear: String(vehicle.year),
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleNickname: vehicle.nickname || "",
        },
      });
    } else {
      router.push({
        pathname: "/(customer)/garage/[id]" as any,
        params: { id: vehicle.id },
      });
    }
  };

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
      >
        <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)" as any)}
            hitSlop={12}
            style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18 }}>Back</Text>
          </Pressable>
          <Text style={{ ...text.title, fontSize: 28, marginTop: spacing.sm }}>My Garage</Text>
          {isSelectMode && (
            <Text style={{ ...text.muted, marginTop: 4 }}>Select a vehicle for your service request</Text>
          )}
        </View>

        {vehicles.length === 0 ? (
          <View style={[card, { padding: spacing.xl, alignItems: "center", gap: spacing.md }]}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: `${colors.accent}15`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="car-outline" size={40} color={colors.accent} />
            </View>
            <Text style={{ ...text.section, textAlign: "center" }}>No vehicles yet</Text>
            <Text style={{ ...text.muted, textAlign: "center", lineHeight: 20 }}>
              Add your first vehicle to get faster, more accurate quotes from mechanics.
            </Text>
            <Pressable
              onPress={() => router.push("/(customer)/garage/add" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accent,
                  paddingVertical: 14,
                  paddingHorizontal: spacing.xl,
                  borderRadius: 14,
                  marginTop: spacing.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>Add Vehicle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {vehicles.map((vehicle) => {
              const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${encodeURIComponent(
                vehicle.model.split(" ")[0] || vehicle.model
              )}&make=${encodeURIComponent(vehicle.make)}&modelYear=${encodeURIComponent(
                String(vehicle.year)
              )}&angle=29`;

              return (
                <Pressable
                  key={vehicle.id}
                  onPress={() => handleSelectVehicle(vehicle)}
                  style={({ pressed }) => [
                    card,
                    { padding: spacing.md, gap: spacing.md },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={{
                        width: 90,
                        height: 60,
                        borderRadius: 12,
                        backgroundColor: colors.bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: "hidden",
                      }}
                    >
                      <Image source={{ uri: carImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...text.body, fontWeight: "900", fontSize: 16 }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                      {vehicle.nickname && (
                        <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>"{vehicle.nickname}"</Text>
                      )}
                    </View>
                    {!isSelectMode && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  </View>

                  {isSelectMode && (
                    <View
                      style={{
                        backgroundColor: colors.accent,
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontWeight: "900", color: "#fff", fontSize: 15 }}>Use this vehicle</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => router.push("/(customer)/garage/add" as any)}
              style={({ pressed }) => [
                card,
                {
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: colors.accent,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.accent }}>Add New Vehicle</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
