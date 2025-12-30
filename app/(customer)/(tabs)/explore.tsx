import React, { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { spacing } from "../../../src/ui/theme";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { VehicleChip } from "../../../src/components/VehicleChip";
import { VehiclePickerDrawer } from "../../../src/components/VehiclePickerDrawer";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type Symptom = {
  key: string;
  icon: string;
  label: string;
  description: string;
};

const symptoms: Symptom[] = [
  { key: "wont_start", icon: "🚨", label: "Wont start", description: "Engine wont turn over or crank" },
  { key: "warning_light", icon: "🔔", label: "Warning light", description: "Dashboard warning or check engine light" },
  { key: "brakes_wrong", icon: "🛑", label: "Brakes feel wrong", description: "Soft pedal, grinding, or pulling" },
  { key: "strange_noise", icon: "🔊", label: "Strange noise", description: "Unusual sounds while driving" },
  { key: "fluid_leak", icon: "💧", label: "Fluid leak", description: "Puddle or drips under vehicle" },
  { key: "battery_issues", icon: "🔋", label: "Battery issues", description: "Weak start or electrical problems" },
  { key: "maintenance", icon: "🧰", label: "Maintenance", description: "Scheduled service or inspection" },
  { key: "not_sure", icon: "❓", label: "Not sure", description: "Need diagnosis to identify issue" },
];

export default function Explore() {
  const router = useRouter();
  const { colors } = useTheme();
  const card = createCard(colors);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      setLoadingVehicles(true);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setVehicles((data as Vehicle[]) ?? []);
    } catch (e: any) {
      console.error("Failed to load vehicles:", e);
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  useEffect(() => {
    if (vehicles.length === 1 && !selectedVehicleId) {
      const vehicle = vehicles[0];
      setSelectedVehicleId(vehicle.id);
      setSelectedVehicle(vehicle);
    }
  }, [vehicles, selectedVehicleId]);

  const handleSymptomSelect = (symptomKey: string) => {
    if (!selectedVehicleId || !selectedVehicle) {
      setShowVehicleDrawer(true);
      return;
    }

    console.log("🚗 Explore: Symptom selected", {
      symptom: symptomKey,
      vehicleId: selectedVehicleId,
      vehicle: selectedVehicle,
    });

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
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicle(vehicle);
    setShowVehicleDrawer(false);
  };

  const handleChangeVehicle = () => {
    setShowVehicleDrawer(true);
  };

  const handleAddNewVehicle = () => {
    setShowVehicleDrawer(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "explorer",
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
        onAddNew={handleAddNewVehicle}
        loading={loadingVehicles}
        returnTo="explore"
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
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
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: colors.textPrimary,
                  marginBottom: 2,
                }}
              >
                Select Your Vehicle
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                Choose which car needs service
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
          </Pressable>
        )}

        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent +"80",
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.textPrimary,
              marginBottom: spacing.xs,
            }}
          >
            Hey there! I&apos;m Wrench, your car care buddy.
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            Tell me what&apos;s going on with your car, and I&apos;ll connect you with trusted mechanics nearby.
          </Text>
          <Image
            source={require("../../../assets/wrench.png")}
            style={{
              width: 64,
              height: 64,
              position: "absolute",
              right: 8,
              bottom: 8,
            }}
            resizeMode="contain"
          />
        </View>

        <View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}
          >
            What&apos;s the issue?
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.md,
            }}
          >
            Select the symptom that best describes your problem
          </Text>

          <View style={{ gap: spacing.sm }}>
            {symptoms.map((symptom) => (
              <Pressable
                key={symptom.key}
                onPress={() => handleSymptomSelect(symptom.key)}
                style={({ pressed }) => [
                  card,
                  pressed && cardPressed,
                  {
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  },
                ]}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.accent + "15",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{symptom.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    {symptom.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "500",
                      color: colors.textMuted,
                    }}
                  >
                    {symptom.description}
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: colors.textMuted }}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
