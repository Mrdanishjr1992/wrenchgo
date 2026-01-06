import React, { useCallback, useState, useMemo, useEffect, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { isValidUUID } from "../../../src/lib/validation";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";

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

type VehicleMake = { MakeId: number; MakeName: string };
type VehicleModel = { Model_ID: number; Model_Name: string };

export default function VehicleDetail() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ id: string | string[] }>();
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const id = normalizeParam(rawParams.id);
  const loadedRef = useRef(false);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [year, setYear] = useState("");
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

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear + 1; y >= 1980; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const fetchMakes = useCallback(async (selectedYear: string): Promise<VehicleMake[]> => {
    if (!selectedYear) return [];
    try {
      setLoadingMakes(true);
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json`);
      const data = await response.json();
      if (data.Results?.length > 0) {
        const sorted = data.Results.filter((m: VehicleMake) => m.MakeName).sort((a: VehicleMake, b: VehicleMake) =>
          a.MakeName.localeCompare(b.MakeName)
        );
        setMakes(sorted);
        return sorted;
      }
      setMakes([]);
      return [];
    } catch (e) {
      return [];
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
      // ignore
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const loadVehicle = useCallback(async () => {
    if (!id || id === "index" || id === "add" || !isValidUUID(id)) {
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
        .eq("customer_id", userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Vehicle not found");

      setVehicle(data);
      setYear(String(data.year));
      setMake(data.make);
      setModel(data.model);
      setNickname(data.nickname || "");

      const fetchedMakes = await fetchMakes(String(data.year));
      const foundMake = fetchedMakes.find((m) => m.MakeName.toLowerCase() === data.make.toLowerCase());
      if (foundMake) {
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
      if (!loadedRef.current) {
        loadedRef.current = true;
        loadVehicle();
      }
    }, [loadVehicle])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVehicle();
    setRefreshing(false);
  }, [loadVehicle]);

  const handleSave = async () => {
    if (!id || !isValidUUID(id)) {
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
      Alert.alert("Success", "Vehicle updated successfully.");
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

    Alert.alert("Delete Vehicle", "Are you sure you want to delete this vehicle? This cannot be undone.", [
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
    ]);
  };

  const handleYearChange = async (newYear: string) => {
    setYear(newYear);
    setMake("");
    setModel("");
    setModels([]);
    await fetchMakes(newYear);
  };

  const handleMakeChange = async (selectedMake: VehicleMake) => {
    setMake(selectedMake.MakeName);
    setModel("");
    await fetchModels(selectedMake.MakeId, year);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading...</Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={text.muted}>Vehicle not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const canSave = year && make.trim() && model.trim();

  const carImageUrl = year && make && model
    ? `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${encodeURIComponent(
        model.split(" ")[0] || model
      )}&make=${encodeURIComponent(make)}&modelYear=${encodeURIComponent(year)}&angle=29`
    : null;

  const PickerModal = ({
    visible,
    onClose,
    title,
    data,
    onSelect,
    isLoading,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    data: any[];
    onSelect: (item: any) => void;
    isLoading?: boolean;
  }) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" }}>
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

          {isLoading ? (
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
            <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18 }}>Back</Text>
          </Pressable>
          <Text style={{ ...text.title, fontSize: 28, marginTop: spacing.sm }}>Edit Vehicle</Text>
        </View>

        <View style={[card, { padding: spacing.md, gap: spacing.md }]}>
          {carImageUrl && (
            <View
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: spacing.md,
                alignItems: "center",
              }}
            >
              <View style={{ width: 200, height: 120, borderRadius: 12, overflow: "hidden" }}>
                <Image source={{ uri: carImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
              </View>
              <Text style={{ ...text.section, marginTop: spacing.sm, textAlign: "center" }}>
                {year} {make} {model}
              </Text>
              {nickname && <Text style={{ ...text.muted, marginTop: 4 }}>"{nickname}"</Text>}
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
            value={make}
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
            value={model}
            placeholder="Select model"
            onPress={() => {
              if (!make) {
                Alert.alert("Select Make First", "Please select a make before choosing a model.");
                return;
              }
              setShowModelPicker(true);
            }}
            disabled={!make}
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
          onPress={handleSave}
          disabled={!canSave || saving}
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
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontWeight: "900", color: canSave ? "#fff" : colors.textMuted, fontSize: 16 }}>
              Save Changes
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleDelete}
          disabled={deleting}
          style={({ pressed }) => [
            card,
            {
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderColor: "#EF4444",
              alignItems: "center",
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          {deleting ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <Text style={{ fontWeight: "900", color: "#EF4444", fontSize: 16 }}>Delete Vehicle</Text>
          )}
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        title="Select Year"
        data={years}
        onSelect={(y) => handleYearChange(String(y))}
      />

      <PickerModal
        visible={showMakePicker}
        onClose={() => setShowMakePicker(false)}
        title="Select Make"
        data={makes}
        onSelect={handleMakeChange}
        isLoading={loadingMakes}
      />

      <PickerModal
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        title="Select Model"
        data={models}
        onSelect={(selectedModel: VehicleModel) => setModel(selectedModel.Model_Name)}
        isLoading={loadingModels}
      />
    </KeyboardAvoidingView>
  );
}
