import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { spacing } from "../../../src/ui/theme";
import { useTheme } from "../../../src/ui/theme-context";

type VehicleMake = {
  MakeId: number;
  MakeName: string;
};

type VehicleModel = {
  Model_ID: number;
  Model_Name: string;
};

export default function AddVehicle() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { colors } = useTheme();

  const [year, setYear] = useState("");
  const [makeId, setMakeId] = useState<number | null>(null);
  const [makeName, setMakeName] = useState("");
  const [modelName, setModelName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMakePicker, setShowMakePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const normalizeReturnTo = (returnTo: string | string[] | undefined): string => {
    if (!returnTo) return "/(customer)/(tabs)/explore";
    const normalized = Array.isArray(returnTo) ? returnTo[0] : returnTo;

    const allowedPaths: Record<string, string> = {
      "explore": "/(customer)/(tabs)/explore",
      "request-service": "/(customer)/request-service",
    };

    return allowedPaths[normalized] || "/(customer)/(tabs)/explore";
  };



  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  const fetchMakes = useCallback(async (selectedYear: string) => {
    if (!selectedYear) return;
    try {
      setLoadingMakes(true);
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json`
      );
      const data = await response.json();
      if (data.Results && data.Results.length > 0) {
        const filtered = data.Results.filter((m: VehicleMake) => m.MakeName);
        const sorted = filtered.sort((a: VehicleMake, b: VehicleMake) =>
          a.MakeName.localeCompare(b.MakeName)
        );
        setMakes(sorted);
      } else {
        setMakes([]);
      }
    } catch (e) {
      console.error("Failed to fetch makes:", e);
      Alert.alert("Error", "Failed to load vehicle makes");
    } finally {
      setLoadingMakes(false);
    }
  }, []);

  const fetchModels = useCallback(async (selectedMakeId: number, selectedYear: string) => {
    if (!selectedMakeId || !selectedYear) return;
    try {
      setLoadingModels(true);
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/${selectedMakeId}/modelyear/${selectedYear}?format=json`
      );
      const data = await response.json();
      if (data.Results) {
        setModels(data.Results.filter((m: VehicleModel) => m.Model_Name).sort((a: VehicleModel, b: VehicleModel) =>
          a.Model_Name.localeCompare(b.Model_Name)
        ));
      }
    } catch (e) {
      console.error("Failed to fetch models:", e);
      Alert.alert("Error", "Failed to load vehicle models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (year) {
      fetchMakes(year);
      setMakeId(null);
      setMakeName("");
      setModelName("");
      setModels([]);
    }
  }, [year, fetchMakes]);

  useEffect(() => {
    if (makeId && year) {
      fetchModels(makeId, year);
      setModelName("");
    }
  }, [makeId, year, fetchModels]);

  const canSave = useMemo(() => {
    return year && makeName && modelName && !loading;
  }, [year, makeName, modelName, loading]);

  const save = async () => {
    try {
      setLoading(true);

      if (!year || !makeName || !modelName) {
        Alert.alert("Missing info", "Year, make, and model are required.");
        return;
      }

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data: newVehicle, error } = await supabase.from("vehicles").insert({
        customer_id: userId,
        year: Number(year),
        make: makeName,
        model: modelName,
        nickname: nickname.trim() || null,
      }).select("id,year,make,model,nickname").single();

      if (error) throw error;

      Alert.alert("Added ✅", "Vehicle added to your garage.");

      const returnToPath = normalizeReturnTo(params.returnTo);

      console.log("🚗 Garage/Add: Vehicle created", {
        vehicleId: newVehicle.id,
        year: newVehicle.year,
        make: newVehicle.make,
        model: newVehicle.model,
        returnTo: returnToPath,
      });

      if (returnToPath === "/(customer)/(tabs)/explore" || returnToPath === "/(customer)/request-service") {
        router.replace({
          pathname: returnToPath as any,
          params: {
            vehicleId: newVehicle.id,
            vehicleYear: String(newVehicle.year),
            vehicleMake: newVehicle.make,
            vehicleModel: newVehicle.model,
            vehicleNickname: newVehicle.nickname || "",
          },
        });
      } else {
        router.push({
          pathname: "/(customer)/garage/[id]" as any,
          params: { id: newVehicle.id },
        });
      }
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not add vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const PickerModal = ({
    visible,
    onClose,
    title,
    data,
    onSelect,
    loading: pickerLoading,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    data: any[];
    onSelect: (item: any) => void;
    loading?: boolean;
  }) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "70%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.textPrimary }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.accent }}>Close</Text>
            </Pressable>
          </View>

          {pickerLoading ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ marginTop: spacing.sm, color: colors.textMuted }}>Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item, index) => `${item.MakeId || item.Model_ID || item}-${index}`}
              renderItem={({ item }) => {
                const label = typeof item === "number" ? String(item) : item.MakeName || item.Model_Name || item;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={({ pressed }) => ({
                      padding: spacing.md,
                      backgroundColor: pressed ? colors.bg : colors.surface,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    })}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>{label}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl,
          backgroundColor: colors.bg,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
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
            Let&apos;s add your car to the garage. This helps mechanics give better quotes.
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

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: 8,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: spacing.sm }}>
            <View style={{ width: 200, height: 120, borderRadius: 16, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border, overflow: "hidden" }}>
              {year && makeName && modelName ? (
                <Image
                  source={require("../../../assets/carimage.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 64 }}>🚙</Text>
              )}
            </View>
            {year && makeName && modelName && (
              <Text style={{ marginTop: spacing.sm, fontSize: 16, fontWeight: "800", color: colors.textPrimary, textAlign: "center" }}>
                {year} {makeName} {modelName}
              </Text>
            )}
          </View>

          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.textPrimary }}>Add a vehicle</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
            Select your vehicle details from our database.
          </Text>

          {/* Year Selector */}
          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontWeight: "900", color: colors.textPrimary, marginBottom: 8 }}>Year</Text>
            <Pressable
              onPress={() => setShowYearPicker(true)}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: year ? colors.textPrimary : colors.textMuted,
                }}
              >
                {year || "Select year"}
              </Text>
            </Pressable>
          </View>

          {/* Make Selector */}
          <View>
            <Text style={{ fontWeight: "900", color: colors.textPrimary, marginBottom: 8 }}>Make</Text>
            <Pressable
              onPress={() => {
                if (!year) {
                  Alert.alert("Select Year First", "Please select a year before choosing a make.");
                  return;
                }
                setShowMakePicker(true);
              }}
              disabled={!year || loadingMakes}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                opacity: !year ? 0.5 : 1,
              }}
            >
              {loadingMakes ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: makeName ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {makeName || "Select make"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Model Selector */}
          <View>
            <Text style={{ fontWeight: "900", color: colors.textPrimary, marginBottom: 8 }}>Model</Text>
            <Pressable
              onPress={() => {
                if (!makeName) {
                  Alert.alert("Select Make First", "Please select a make before choosing a model.");
                  return;
                }
                setShowModelPicker(true);
              }}
              disabled={!makeName || loadingModels}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                opacity: !makeName ? 0.5 : 1,
              }}
            >
              {loadingModels ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: modelName ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {modelName || "Select model"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Nickname */}
          <View>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontWeight: "900", color: colors.textPrimary }}>Nickname</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted }}>Optional</Text>
            </View>
            <View
              style={{
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="My daily driver"
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  padding: 0,
                }}
              />
            </View>
          </View>

          <Pressable
            onPress={save}
            disabled={!canSave}
            style={{
              marginTop: spacing.md,
              backgroundColor: canSave ? colors.accent : colors.border,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontWeight: "900", color: canSave ? "#000" : colors.textMuted }}>ADD VEHICLE</Text>
            )}
          </Pressable>

          {!canSave && !loading ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              Select year, make, and model to continue.
            </Text>
          ) : null}

          <Pressable
            onPress={() => router.back()}
            disabled={loading}
            style={{
              marginTop: spacing.sm,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.textMuted }}>CANCEL</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PickerModal
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        title="Select Year"
        data={years}
        onSelect={(y) => {
          setYear(String(y));
          setShowYearPicker(false);
        }}
      />

      <PickerModal
        visible={showMakePicker}
        onClose={() => setShowMakePicker(false)}
        title="Select Make"
        data={makes}
        onSelect={(make: VehicleMake) => {
          setMakeId(make.MakeId);
          setMakeName(make.MakeName);
          setShowMakePicker(false);
        }}
        loading={loadingMakes}
      />

      <PickerModal
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        title="Select Model"
        data={models}
        onSelect={(model: VehicleModel) => {
          setModelName(model.Model_Name);
          setShowModelPicker(false);
        }}
        loading={loadingModels}
      />
    </KeyboardAvoidingView>
  );
}
