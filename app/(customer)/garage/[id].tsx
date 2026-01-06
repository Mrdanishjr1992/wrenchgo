import React, { useCallback, useState, useMemo, useEffect } from "react";
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
  Image,
  Modal,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { isValidUUID } from "../../../src/lib/validation";
import { spacing } from "../../../src/ui/theme";
import { useTheme } from "../../../src/ui/theme-context";

const normalizeParam = (param: string | string[] | undefined): string | undefined => {
  if (!param) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
};

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  customer_id: string;
};

type VehicleMake = {
  MakeId: number;
  MakeName: string;
};

type VehicleModel = {
  Model_ID: number;
  Model_Name: string;
};

export default function VehicleDetail() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ id: string | string[] }>();
  const { colors } = useTheme();

  const id = normalizeParam(rawParams.id);
  const [didRedirect, setDidRedirect] = useState(false);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [year, setYear] = useState("");
  const [makeId, setMakeId] = useState<number | null>(null);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMakePicker, setShowMakePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const isNewVehicle = id === "new";

  useEffect(() => {
    if (!didRedirect && !isNewVehicle && (!id || id === "index" || id === "add" || !isValidUUID(id))) {
      setDidRedirect(true);
      Alert.alert(
        "Invalid Vehicle",
        "The vehicle ID is invalid. Returning to garage.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(customer)/garage/index" as any),
          },
        ],
        { cancelable: false }
      );
    }
  }, [id, router, didRedirect, isNewVehicle]);

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
      <View style={{ flex: 1, backgroundColor: colors.accent ?? "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
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

  const loadVehicle = useCallback(async () => {
    if (!id || id === "index" || id === "add" || id === "new" || !isValidUUID(id)) {
      setLoading(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      router.replace("/(auth)/sign-in");
      return;
    }
    try {
      setLoading(true);
    const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .eq("customer_id", userId)   // ✅ ownership gate
        .single();

      if (error) throw error;
      if (!data) throw new Error("Vehicle not found");

      setVehicle(data);
      setYear(String(data.year));
      setMake(data.make);
      setModel(data.model);
      setNickname(data.nickname || "");

      await fetchMakes(String(data.year));

const foundMake = makes.find(
  (m) => m.MakeName.toLowerCase() === data.make.toLowerCase()
);

if (foundMake) {
  setMakeId(foundMake.MakeId);
  await fetchModels(foundMake.MakeId, String(data.year));
}

    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load vehicle");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, fetchMakes, fetchModels]);

  useFocusEffect(
    useCallback(() => {
      loadVehicle();
    }, [loadVehicle])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVehicle();
    setRefreshing(false);
  }, [loadVehicle]);

  const handleSave = async () => {
    const isNew = id === "new";

    if (!isNew && (!id || !isValidUUID(id))) {
      Alert.alert("Error", "Invalid vehicle ID");
      return;
    }

    const yr = Number(year);
    const currentYearPlus1 = new Date().getFullYear() + 1;

    if (!year || yr < 1900 || yr > currentYearPlus1) {
      Alert.alert("Invalid Year", `Enter a year between 1900 and ${currentYearPlus1}.`);
      return;
    }
    if (!make.trim()) {
      Alert.alert("Invalid Make", "Enter the vehicle make.");
      return;
    }
    if (!model.trim()) {
      Alert.alert("Invalid Model", "Enter the vehicle model.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      router.replace("/(auth)/sign-in");
      return;
    }
    try {
      setSaving(true);

      if (isNew) {
        const { error } = await supabase
          .from("vehicles")
          .insert({
            customer_id: userId,
            year: yr,
            make: make.trim(),
            model: model.trim(),
            nickname: nickname.trim() || null,
          });
        if (error) throw error;
        Alert.alert("Saved ✅", "Vehicle added successfully.");
      } else {
        const { error } = await supabase
          .from("vehicles")
          .update({
            year: yr,
            make: make.trim(),
            model: model.trim(),
            nickname: nickname.trim() || null,
          })
          .eq("id", id)
          .eq("customer_id", userId);
        if (error) throw error;
        Alert.alert("Saved ✅", "Vehicle updated successfully.");
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not update vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !isValidUUID(id)) {
      Alert.alert("Error", "Invalid vehicle ID");
      return;
    }

    Alert.alert(
      "Delete Vehicle",
      "Are you sure you want to delete this vehicle? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              const { error } = await supabase.from("vehicles").delete().eq("id", id);
              if (error) throw error;

              Alert.alert("Deleted", "Vehicle removed from your garage.");
              router.back();
            } catch (e: any) {
              Alert.alert("Failed", e?.message ?? "Could not delete vehicle.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 12, fontSize: 13, fontWeight: "600", color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  const canSave = year && make.trim() && model.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <Stack.Screen
          options={{
            title: "Edit Vehicle",
            headerStyle: { backgroundColor: colors.bg }, // match your tabs header
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
            headerBackTitleVisible: false,
          }}
        />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl,
          backgroundColor: colors.bg,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
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
              {year && make && model ? (
                <Image
                  source={require("../../../assets/carimage.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 48 }}>🚗</Text>
              )}
            </View>
          </View>

          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.textPrimary }}>Edit Vehicle</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
            Update your vehicle information.
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
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

            <View style={{ flex: 2 }}>
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
                      color: make ? colors.textPrimary : colors.textMuted,
                    }}
                  >
                    {make || "Select make"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={{ fontWeight: "900", color: colors.textPrimary, marginBottom: 8 }}>Model</Text>
            <Pressable
              onPress={() => {
                if (!make) {
                  Alert.alert("Select Make First", "Please select a make before choosing a model.");
                  return;
                }
                setShowModelPicker(true);
              }}
              disabled={!make || loadingModels}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                opacity: !make ? 0.5 : 1,
              }}
            >
              {loadingModels ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: model ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {model || "Select model"}
                </Text>
              )}
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "900", color: colors.textPrimary }}>Nickname</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted }}>Optional</Text>
            </View>
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

          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={{
              marginTop: spacing.md,
              backgroundColor: canSave ? colors.accent : colors.border,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontWeight: "900", color: canSave ? "#000" : colors.textMuted }}>SAVE CHANGES</Text>
            )}
          </Pressable>

          {!canSave ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>
              Enter a valid year + make + model to continue.
            </Text>
          ) : null}

          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: "#ef4444",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Text style={{ fontWeight: "900", color: "#ef4444" }}>DELETE VEHICLE</Text>
            )}
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
          fetchMakes(String(y));
          setMakeId(null);
          setMake("");
          setModel("");
          setModels([]);
        }}
      />

      <PickerModal
        visible={showMakePicker}
        onClose={() => setShowMakePicker(false)}
        title="Select Make"
        data={makes}
        onSelect={(selectedMake: VehicleMake) => {
          setMakeId(selectedMake.MakeId);
          setMake(selectedMake.MakeName);
          setShowMakePicker(false);
          fetchModels(selectedMake.MakeId, year);
          setModel("");
        }}
        loading={loadingMakes}
      />

      <PickerModal
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        title="Select Model"
        data={models}
        onSelect={(selectedModel: VehicleModel) => {
          setModel(selectedModel.Model_Name);
          setShowModelPicker(false);
        }}
        loading={loadingModels}
      />
    </KeyboardAvoidingView>
  );
}
