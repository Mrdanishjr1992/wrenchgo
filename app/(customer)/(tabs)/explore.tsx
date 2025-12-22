import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";

type Mechanic = {
  id: string;
  full_name: string | null;
  shop_name?: string | null;
  available_now?: boolean | null;
};

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  created_at?: string;
};

export default function Explore() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobTitle?: string; preferredTime?: string }>();

  const [jobTitle, setJobTitle] = useState(params.jobTitle ?? "");
  const [preferredTime, setPreferredTime] = useState(params.preferredTime ?? "");
  const [jobDesc, setJobDesc] = useState("");

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [sending, setSending] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ✅ Load vehicles whenever this tab is focused
  const loadVehicles = useCallback(async () => {
    try {
      setLoadingVehicles(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = userData.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname,created_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data as Vehicle[]) ?? [];
      setVehicles(list);

      // auto-select first vehicle if none selected
      if (!selectedVehicleId && list.length > 0) {
        setSelectedVehicleId(list[0].id);
      }
    } catch (e: any) {
      Alert.alert("Garage load error", e?.message ?? "Failed to load vehicles.");
    } finally {
      setLoadingVehicles(false);
    }
  }, [selectedVehicleId]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  // Mechanics load once (your original behavior)
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            `
            id, full_name,
            mechanic_profiles:mechanic_profiles(shop_name, available_now)
          `
          )
          .eq("role", "mechanic");

        if (error) {
          Alert.alert("Error", error.message);
          return;
        }

        setMechanics(
          (data ?? []).map((m: any) => ({
            id: m.id,
            full_name: m.full_name,
            shop_name: m.mechanic_profiles?.shop_name ?? null,
            available_now: m.mechanic_profiles?.available_now ?? null,
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const requestQuotes = async () => {
    if (sending || selected.size === 0) return;

    try {
      setSending(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const customerId = userData.user?.id;
      if (!customerId) throw new Error("Not signed in");

      // (Optional) Require vehicle
      // if (!selectedVehicleId) {
      //   Alert.alert("Select vehicle", "Choose a vehicle before requesting quotes.");
      //   return;
      // }

      const { data: job, error: jErr } = await supabase
        .from("jobs")
        .insert({
          customer_id: customerId,
          title: jobTitle || "Vehicle issue",
          description: jobDesc || null,
          preferred_time: preferredTime || null,
          status: "searching",
          vehicle_id: selectedVehicleId ?? null,
        })
        .select("id")
        .single();

      if (jErr) throw jErr;
      if (!job?.id) throw new Error("Job not created");

      const rows = Array.from(selected).map((mechanic_id) => ({
        job_id: job.id,
        mechanic_id,
        customer_id: customerId,
        status: "pending",
      }));

      const { error: qErr } = await supabase
        .from("quote_requests")
        .upsert(rows, { onConflict: "job_id,mechanic_id" });

      if (qErr) throw qErr;

      router.push(`/(customer)/job/${job.id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to request quotes.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      {/* Vehicle picker */}
      <Text style={text.title}>Vehicle</Text>

      {loadingVehicles ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm }} />
      ) : vehicles.length === 0 ? (
        <Pressable onPress={() => router.push("/(customer)/garage/add" as any)}>
          <Text
            style={{
              color: colors.accent,
              fontWeight: "900",
              marginTop: spacing.sm,
            }}
          >
            + Add a vehicle
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {vehicles.map((v) => {
            const active = selectedVehicleId === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelectedVehicleId(v.id)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                <Text style={text.section}>
                  {v.year} {v.make} {v.model}
                </Text>
                {v.nickname ? <Text style={text.muted}>“{v.nickname}”</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Job details */}
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text style={text.section}>Job details</Text>

        <TextInput
          value={jobTitle}
          onChangeText={setJobTitle}
          placeholder="Job title (ex: Brake noise)"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          value={preferredTime}
          onChangeText={setPreferredTime}
          placeholder="Preferred time (optional)"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          value={jobDesc}
          onChangeText={setJobDesc}
          placeholder="Extra details for the mechanic (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textPrimary,
            minHeight: 80,
          }}
        />
      </View>

      {/* Mechanics */}
      <Text style={{ ...text.title, marginTop: spacing.lg }}>Select Mechanics</Text>

      <FlatList
        style={{ marginTop: spacing.sm }}
        data={mechanics}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: isSelected ? colors.accent : colors.border,
              }}
            >
              <Text style={text.section}>{item.full_name ?? "Mechanic"}</Text>
              <Text style={text.body}>{item.shop_name ?? "Independent mechanic"}</Text>
              <Text style={text.muted}>
                {item.available_now ? "Available now" : "Schedule"}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* CTA */}
      <Pressable
        onPress={requestQuotes}
        disabled={sending || selected.size === 0}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.accent,
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: "center",
          opacity: sending || selected.size === 0 ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "900", color: "#000" }}>
          {sending ? "SENDING…" : "REQUEST QUOTES"}
        </Text>
      </Pressable>
    </View>
  );
}
