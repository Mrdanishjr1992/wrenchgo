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
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { spacing } from "../../../src/ui/theme";
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
  const { colors } = useTheme();
  const card = createCard(colors);

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

    console.log("🚗 Garage: Vehicle selected", {
      vehicleId: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      returnTo: returnToPath,
    });

    if (returnToPath === "/(customer)/(tabs)/explore" || returnToPath === "/(customer)/request-service") {
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
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
<Stack.Screen
  options={{
    title: "My Garage",
  }}
/>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 12, fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  const returnToNormalized = useMemo(() => {
  if (!params.returnTo) return undefined;
  return Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
}, [params.returnTo]);



  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
<Stack.Screen
  options={{
    title: "My Garage",
  }}
/>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "20",
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            Which car needs help today?
          </Text>
          <Image
            source={require("../../../assets/peaking.png")}
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              marginTop: -32,
              width: 64,
              height: 64,
            }}
            resizeMode="contain"
          />
        </View>

        {vehicles.length === 0 ? (
          <View
            style={[
              card,
              {
                padding: spacing.lg,
                alignItems: "center",
                gap: spacing.sm,
              },
            ]}
          >
            <Text style={{ fontSize: 48 }}>🚗</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              No vehicles yet
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Add your first vehicle to get started with faster, more accurate quotes.
            </Text>
            <Pressable
              onPress={() => router.push("/(customer)/garage/add")}
              style={({ pressed }) => [
                {
                  marginTop: spacing.sm,
                  backgroundColor: colors.accent,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: 14,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
            >
              <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16, letterSpacing: 0.3 }}>
                Add Vehicle
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {vehicles.map((item) => {
              const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${item.model.split(" ")[0]}&make=${item.make}&modelYear=${item.year}&angle=29`;

              return (
                <View key={item.id} style={[card, { padding: spacing.md, gap: spacing.md }]}>
                  <Pressable
                    onPress={() => handleSelectVehicle(item)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 80,
                        height: 50,
                        borderRadius: 12,
                        backgroundColor: colors.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri: carImageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                        {item.year} {item.make} {item.model}
                      </Text>
                      {item.nickname ? (
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                          &ldquo;{item.nickname}&rdquo;
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>

                  {(returnToNormalized === "request-service" || returnToNormalized === "explore") && (
                    <Pressable
                      onPress={() => handleSelectVehicle(item)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.accent,
                          padding: spacing.md,
                          borderRadius: 12,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: "900",
                          textAlign: "center",
                          letterSpacing: 0.3,
                        }}
                      >
                        Use this vehicle
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable
              onPress={() => router.push("/(customer)/garage/add")}
              style={({ pressed }) => [
                card,
                {
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  borderStyle: "dashed",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 24, color: colors.accent }}>+</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.accent }}>
                Add New Vehicle
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
