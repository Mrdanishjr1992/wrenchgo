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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";

type VehicleMake = { MakeId: number; MakeName: string };
type VehicleModel = { Model_ID: number; Model_Name: string };

export default function AddVehicle() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

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
    for (let y = currentYear + 1; y >= 1980; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const fetchMakes = useCallback(async (selectedYear: string) => {
    if (!selectedYear) return;
    try {
      setLoadingMakes(true);
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json`);
      const data = await response.json();
      if (data.Results?.length > 0) {
        const sorted = data.Results.filter((m: VehicleMake) => m.MakeName).sort((a: VehicleMake, b: VehicleMake) =>
          a.MakeName.localeCompare(b.MakeName)
        );
        setMakes(sorted);
      } else {
        setMakes([]);
      }
    } catch (e) {
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
        setModels(
          data.Results.filter((m: VehicleModel) => m.Model_Name).sort((a: VehicleModel, b: VehicleModel) =>
            a.Model_Name.localeCompare(b.Model_Name)
          )
        );
      }
    } catch (e) {
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

  const canSave = useMemo(() => year && makeName && modelName && !loading, [year, makeName, modelName, loading]);

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

      const { data: newVehicle, error } = await supabase
        .from("vehicles")
        .insert({
          customer_id: userId,
          year: Number(year),
          make: makeName,
          model: modelName,
          nickname: nickname.trim() || null,
        })
        .select("id,year,make,model,nickname")
        .single();

      if (error) throw error;

      Alert.alert("Success", "Vehicle added to your garage.");

      const returnToPath = normalizeReturnTo(params.returnTo);
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
        router.back();
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
              padding: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ ...text.section }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.accent }}>Done</Text>
            </Pressable>
          </View>

          {pickerLoading ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ marginTop: spacing.sm, ...text.muted }}>Loading...</Text>
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
                    <Text style={{ ...text.body, fontWeight: "600" }}>{label}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const SelectField = ({
    label,
    value,
    placeholder,
    onPress,
    disabled,
    isLoading,
  }: {
    label: string;
    value: string;
    placeholder: string;
    onPress: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }) => (
    <View>
      <Text style={{ ...text.body, fontWeight: "900", marginBottom: 8 }}>{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled || isLoading}
        style={({ pressed }) => [
          {
            backgroundColor: colors.bg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: disabled ? 0.5 : 1,
          },
          pressed && { opacity: 0.9 },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <>
            <Text style={{ ...text.body, fontWeight: "700", color: value ? colors.textPrimary : colors.textMuted }}>
              {value || placeholder}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18 }}>Cancel</Text>
          </Pressable>
          <Text style={{ ...text.title, fontSize: 28, marginTop: spacing.sm }}>Add Vehicle</Text>
          <Text style={{ ...text.muted, marginTop: 4 }}>Add your car to get better quotes</Text>
        </View>

        <View style={[card, { padding: spacing.md, gap: spacing.md }]}>
          {year && makeName && modelName && (
            <View
              style={{
                backgroundColor: `${colors.accent}10`,
                borderWidth: 1,
                borderColor: `${colors.accent}30`,
                borderRadius: 12,
                padding: spacing.md,
                alignItems: "center",
              }}
            >
              <Ionicons name="car-sport" size={40} color={colors.accent} />
              <Text style={{ ...text.section, marginTop: spacing.sm, textAlign: "center" }}>
                {year} {makeName} {modelName}
              </Text>
            </View>
          )}

          <SelectField
            label="Year"
            value={year}
            placeholder="Select year"
            onPress={() => setShowYearPicker(true)}
          />

          <SelectField
            label="Make"
            value={makeName}
            placeholder="Select make"
            onPress={() => {
              if (!year) {
                Alert.alert("Select Year First", "Please select a year before choosing a make.");
                return;
              }
              setShowMakePicker(true);
            }}
            disabled={!year}
            isLoading={loadingMakes}
          />

          <SelectField
            label="Model"
            value={modelName}
            placeholder="Select model"
            onPress={() => {
              if (!makeName) {
                Alert.alert("Select Make First", "Please select a make before choosing a model.");
                return;
              }
              setShowModelPicker(true);
            }}
            disabled={!makeName}
            isLoading={loadingModels}
          />

          <View>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ ...text.body, fontWeight: "900" }}>Nickname</Text>
              <Text style={{ ...text.muted, fontSize: 12 }}>Optional</Text>
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
                placeholder="e.g. My daily driver"
                placeholderTextColor={colors.textMuted}
                style={{ ...text.body, fontWeight: "700", padding: 0 }}
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [
            card,
            {
              padding: spacing.md,
              backgroundColor: canSave ? colors.accent : colors.border,
              borderColor: canSave ? colors.accent : colors.border,
              alignItems: "center",
            },
            pressed && canSave && { opacity: 0.9 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontWeight: "900", color: canSave ? "#fff" : colors.textMuted, fontSize: 16 }}>
              Add Vehicle
            </Text>
          )}
        </Pressable>

        {!canSave && !loading && (
          <Text style={{ ...text.muted, textAlign: "center" }}>Select year, make, and model to continue</Text>
        )}
      </ScrollView>

      <PickerModal
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        title="Select Year"
        data={years}
        onSelect={(y) => setYear(String(y))}
      />

      <PickerModal
        visible={showMakePicker}
        onClose={() => setShowMakePicker(false)}
        title="Select Make"
        data={makes}
        onSelect={(make: VehicleMake) => {
          setMakeId(make.MakeId);
          setMakeName(make.MakeName);
        }}
        loading={loadingMakes}
      />

      <PickerModal
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        title="Select Model"
        data={models}
        onSelect={(model: VehicleModel) => setModelName(model.Model_Name)}
        loading={loadingModels}
      />
    </KeyboardAvoidingView>
  );
}
