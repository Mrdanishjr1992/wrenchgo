import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import React from "react";

type Job = {
  id: string;
  title: string;
  description: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
  } | null;
  created_at: string;
};

type JobIntake = {
  symptom: { key: string; label: string };
  answers: Record<string, string>;
  context: {
    can_move: string;
    location_type: string;
    mileage: string | null;
  };
};

const SYMPTOM_ICONS: Record<string, string> = {
  wont_start: "🚨",
  strange_noise: "🔊",
  warning_light: "⚠️",
  brake_issue: "🛑",
  electrical: "⚡",
  engine: "🔧",
  other: "🔍",
};

const SYSTEM_GUIDANCE: Record<string, {
  safety: "low" | "medium" | "high";
  commonCauses: string[];
  typicalTime: string;
  note: string;
}> = {
  wont_start: {
    safety: "low",
    commonCauses: ["Battery", "Starter", "Alternator", "Connections"],
    typicalTime: "30-45 min",
    note: "Clicking + dim lights suggests electrical issue",
  },
  strange_noise: {
    safety: "medium",
    commonCauses: ["Belt", "Bearing", "Exhaust", "Suspension"],
    typicalTime: "45-60 min",
    note: "Location and timing of noise helps narrow diagnosis",
  },
  warning_light: {
    safety: "medium",
    commonCauses: ["Sensor", "O2 sensor", "Catalytic converter", "Emissions"],
    typicalTime: "30-45 min",
    note: "OBD scan will identify specific code",
  },
  brake_issue: {
    safety: "high",
    commonCauses: ["Pads", "Rotors", "Fluid", "Caliper"],
    typicalTime: "60-90 min",
    note: "Safety-critical - inspect thoroughly",
  },
  electrical: {
    safety: "low",
    commonCauses: ["Battery", "Alternator", "Fuse", "Wiring"],
    typicalTime: "45-60 min",
    note: "Intermittent issues may require extended testing",
  },
  engine: {
    safety: "medium",
    commonCauses: ["Spark plugs", "Fuel system", "Air filter", "Timing"],
    typicalTime: "60-90 min",
    note: "Performance issues often have multiple contributing factors",
  },
  other: {
    safety: "low",
    commonCauses: ["Varies by symptom"],
    typicalTime: "45-60 min",
    note: "In-person inspection recommended",
  },
};

export default function JobDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [intake, setIntake] = useState<JobIntake | null>(null);
  const [showGuidance, setShowGuidance] = useState(true);

  useEffect(() => {
    loadJob();
  }, [params.id]);

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,
          title,
          description,
          created_at,
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", params.id)
        .single();

      if (error) throw error;

      const jobData = {
        ...data,
        vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle
      };

      setJob(jobData);

      try {
        const parsedIntake = data.description ? JSON.parse(data.description) : null;
        setIntake(parsedIntake);
      } catch (e) {
        console.log("Failed to parse intake");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load job");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (isoDate: string) => {
    const now = new Date();
    const then = new Date(isoDate);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getSafetyColor = (level: "low" | "medium" | "high") => {
    if (level === "low") return "#10b981";
    if (level === "medium") return "#f59e0b";
    return "#ef4444";
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!job || !intake) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={text.body}>Job not found</Text>
      </View>
    );
  }

  const symptomIcon = SYMPTOM_ICONS[intake.symptom.key] || "🔍";
  const vehicleText = job.vehicle
    ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`
    : "Vehicle not specified";
  const guidance = SYSTEM_GUIDANCE[intake.symptom.key] || SYSTEM_GUIDANCE.other;
  const safetyColor = getSafetyColor(guidance.safety);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Job Details",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)}
              style={{ marginRight: 4 }}
            >
              <Text style={{ ...text.body, fontSize: 15, color: colors.textPrimary }}>
                Close
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: 48 }}>{symptomIcon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>{intake.symptom.label}</Text>
              <Text style={{ ...text.muted, fontSize: 14, marginTop: 2 }}>{vehicleText}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.xs }}>
            <Text style={{ ...text.muted, fontSize: 13 }}>2.3 mi • {intake.context.location_type}</Text>
            <Text style={{ ...text.muted, fontSize: 13 }}>•</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: intake.context.can_move === "Yes" ? "#10b981" : colors.textMuted,
              }}
            >
              {intake.context.can_move === "Yes" ? "Can move" : "Can't move"}
            </Text>
          </View>

          <Text style={{ ...text.muted, fontSize: 12, marginTop: spacing.xs }}>
            Posted {getTimeAgo(job.created_at)}
          </Text>
        </View>

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Customer&apos;s Description</Text>

          <View style={{ gap: spacing.sm }}>
            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Symptom</Text>
              <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>{intake.symptom.label}</Text>
            </View>

            {Object.keys(intake.answers).length > 0 && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Details</Text>
                {Object.entries(intake.answers).map(([key, value], idx) => (
                  <View
                    key={idx}
                    style={{
                      paddingVertical: spacing.xs,
                      borderBottomWidth: idx < Object.keys(intake.answers).length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ ...text.body, fontSize: 14 }}>{value}</Text>
                  </View>
                ))}
              </View>
            )}

            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Context</Text>
              <Text style={{ ...text.body, fontSize: 14, marginTop: 2 }}>
                Can move: {intake.context.can_move}
              </Text>
              <Text style={{ ...text.body, fontSize: 14 }}>Location: {intake.context.location_type}</Text>
              {intake.context.mileage && (
                <Text style={{ ...text.body, fontSize: 14 }}>Mileage: {intake.context.mileage} mi</Text>
              )}
            </View>
          </View>
        </View>

        {showGuidance && (
          <Pressable
            onPress={() => setShowGuidance(false)}
            style={[
              card,
              {
                padding: spacing.lg,
                gap: spacing.sm,
                backgroundColor: colors.accent + "10",
                borderLeftWidth: 4,
                borderLeftColor: colors.accent,
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>💡 System Notes</Text>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </View>

            <Text style={{ ...text.muted, fontSize: 12, fontStyle: "italic" }}>
              Guidance only - use your professional judgment
            </Text>

            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: safetyColor,
                  }}
                />
                <Text style={{ ...text.body, fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Safety:</Text>{" "}
                  {guidance.safety.charAt(0).toUpperCase() + guidance.safety.slice(1)} risk
                </Text>
              </View>

              <View>
                <Text style={{ ...text.body, fontSize: 14, fontWeight: "700", marginBottom: 4 }}>
                  Common causes:
                </Text>
                <Text style={{ ...text.body, fontSize: 14 }}>{guidance.commonCauses.join(", ")}</Text>
              </View>

              <View>
                <Text style={{ ...text.body, fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Typical diagnostic time:</Text> {guidance.typicalTime}
                </Text>
              </View>

              <View
                style={{
                  marginTop: spacing.xs,
                  paddingTop: spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: colors.accent + "30",
                }}
              >
                <Text style={{ ...text.body, fontSize: 13, fontStyle: "italic" }}>
                  ⚠️ {guidance.note}
                </Text>
              </View>
            </View>
          </Pressable>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Pressable
            onPress={() => router.push(`/(mechanic)/quote-composer/${params.id}` as any)}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: 18,
              borderRadius: radius.lg,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontWeight: "900", fontSize: 17, color: "#000", letterSpacing: 0.5 }}>
              Send Quote
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              paddingVertical: 14,
              borderRadius: radius.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontWeight: "700", fontSize: 15, color: colors.textPrimary }}>Pass</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
