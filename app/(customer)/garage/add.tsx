import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";

export default function AddVehicle() {
  const router = useRouter();

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    try {
      setLoading(true);

      if (!year || !make || !model) {
        Alert.alert("Missing info", "Year, make, and model are required.");
        return;
      }

      const yr = Number(year);
      if (!Number.isInteger(yr) || yr < 1980 || yr > new Date().getFullYear() + 1) {
        Alert.alert("Invalid year", "Enter a valid vehicle year.");
        return;
      }

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("vehicles").insert({
        customer_id: userId,
        year: yr,
        make: make.trim(),
        model: model.trim(),
        nickname: nickname.trim() || null,
      });

      if (error) throw error;

      Alert.alert("Added", "Vehicle added to your garage.");
      router.back(); // goes back to Home / Garage
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not add vehicle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
      <Text style={text.title}>Add vehicle</Text>
      <Text style={{ ...text.muted, marginTop: 6 }}>
        This helps mechanics give better quotes.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <TextInput
          placeholder="Year (e.g. 2018)"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={year}
          onChangeText={setYear}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          placeholder="Make (Toyota, Ford…)"
          placeholderTextColor={colors.textMuted}
          value={make}
          onChangeText={setMake}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          placeholder="Model (Camry, F‑150…)"
          placeholderTextColor={colors.textMuted}
          value={model}
          onChangeText={setModel}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          placeholder="Nickname (optional — “Daily”, “Work Truck”)"
          placeholderTextColor={colors.textMuted}
          value={nickname}
          onChangeText={setNickname}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <Pressable
          onPress={save}
          disabled={loading}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
            marginTop: spacing.sm,
          }}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ fontWeight: "900", color: "#000" }}>
              ADD VEHICLE
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
