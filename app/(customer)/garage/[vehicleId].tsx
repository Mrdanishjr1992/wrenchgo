import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { AppButton } from "../../../src/ui/components/AppButton";

type Vehicle = {
  id: string;
  customer_id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

export default function VehicleDetail() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return;

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .eq("customer_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading vehicle:", error);
        Alert.alert("Error", "Failed to load vehicle details. Please try again.");
        return;
      }

      if (!data) {
        Alert.alert("Not Found", "Vehicle not found or you don't have access.");
        router.back();
        return;
      }

      setVehicle(data);
    } catch (error: any) {
      console.error("Vehicle load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load vehicle.");
    } finally {
      setLoading(false);
    }
  }, [vehicleId, router]);

  useFocusEffect(
    useCallback(() => {
      loadVehicle();
    }, [loadVehicle])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Text style={text.title}>Vehicle not found</Text>
        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Ionicons name="car-sport" size={32} color={colors.accent} />
            <Text style={[text.title, { marginLeft: spacing.md }]}>
              {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Year:</Text>
              <Text style={text.body}>{vehicle.year}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Make:</Text>
              <Text style={text.body}>{vehicle.make}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Model:</Text>
              <Text style={text.body}>{vehicle.model}</Text>
            </View>
            {vehicle.nickname && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={text.muted}>Nickname:</Text>
                <Text style={text.body}>{vehicle.nickname}</Text>
              </View>
            )}
          </View>
        </View>

        <AppButton
          title="Request Service for This Vehicle"
          variant="primary"
          onPress={() => router.push({ pathname: "/(customer)/request-service", params: { vehicleId: vehicle.id } })}
          style={{ marginBottom: spacing.md }}
        />

        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
