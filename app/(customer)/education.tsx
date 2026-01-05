import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { normalize } from "../../src/ui/theme";
import { createCard } from "../../src/ui/styles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";

type SymptomEducation = {
  symptom_key: string;
  title: string;
  summary: string;
  is_it_safe: string;
  what_we_check: string;
  how_quotes_work: string;
};

type SymptomMapping = {
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  customer_explainer: string;
  icon?: string;
};

export default function EducationPage() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const textStyles = useMemo(
    () => ({
      title: { fontSize: normalize(24), fontWeight: "900" as const, color: colors.textPrimary },
      section: { fontSize: normalize(18), fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: normalize(14), fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: normalize(13), fontWeight: "500" as const, color: colors.textMuted },
      caption: { fontSize: normalize(11), fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [symptomEducation, setSymptomEducation] = useState<SymptomEducation[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomMapping[]>([]);
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const toggleGuide = useCallback((symptomKey: string) => {
    setExpandedGuide((prev) => (prev === symptomKey ? null : symptomKey));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [symptomEduRes, symptomsRes] = await Promise.all([
        supabase
          .from("symptom_education")
          .select("symptom_key,title,summary,is_it_safe,what_we_check,how_quotes_work")
          .order("symptom_key"),
        supabase
          .from("symptom_mappings")
          .select(`
            symptom_key,
            symptom_label,
            category,
            risk_level,
            customer_explainer,
            symptom:symptoms!symptom_mappings_symptom_key_fkey (
              icon
            )
          `)
          .order("symptom_label"),
      ]);

      if (symptomEduRes.error) throw symptomEduRes.error;
      if (symptomsRes.error) throw symptomsRes.error;

      setSymptomEducation((symptomEduRes.data as SymptomEducation[]) ?? []);

      const symptomsWithIcons = (symptomsRes.data ?? []).map((row: any) => ({
        symptom_key: row.symptom_key,
        symptom_label: row.symptom_label,
        category: row.category,
        risk_level: row.risk_level,
        customer_explainer: row.customer_explainer,
        icon: row.symptom?.icon ?? "🛠️",
      }));

      setSymptoms(symptomsWithIcons);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = useMemo(() => {
    const cats = new Set(symptoms.map((s) => s.category));
    return ["all", ...Array.from(cats)];
  }, [symptoms]);

  const filteredSymptoms = useMemo(() => {
    if (selectedCategory === "all") return symptoms;
    return symptoms.filter((s) => s.category === selectedCategory);
  }, [symptoms, selectedCategory]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      default:
        return "#10b981";
    }
  };

  const getSafetyColor = (text: string) => {
    const lower = text?.toLowerCase?.() ?? "";
    if (lower.includes("do not drive") || lower.includes("don't drive")) return "#ef4444";
    if (lower.includes("safe")) return "#10b981";
    return "#f59e0b";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Car Care Education",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: spacing.lg + insets.bottom,
          }}
        >
          {/* Hero Section */}
          <View
            style={{
              backgroundColor: colors.surface,
              paddingTop: spacing.lg,
              paddingHorizontal: spacing.lg + insets.left,
              paddingBottom: spacing.lg,
              paddingRight: spacing.lg + insets.right,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={textStyles.title}>Learn About Your Car</Text>
            <Text style={{ ...textStyles.muted, marginTop: spacing.xs }}>
              Understand common issues, safety tips, and what to expect
            </Text>
          </View>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingVertical: spacing.md,
              paddingLeft: spacing.md + insets.left,
              paddingRight: spacing.md + insets.right,
              gap: spacing.sm,
              backgroundColor: colors.surface,
            }}
          >
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: normalize(20),
                  backgroundColor: selectedCategory === cat ? colors.accent : colors.bg,
                  borderWidth: 1,
                  borderColor: selectedCategory === cat ? colors.accent : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: normalize(13),
                    fontWeight: "700",
                    color: selectedCategory === cat ? "#fff" : colors.textMuted,
                  }}
                >
                  {cat === "all" ? "All" : cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Symptom Cards */}
          <View
            style={{
              paddingTop: spacing.lg,
              paddingBottom: spacing.lg,
              paddingLeft: spacing.lg + insets.left,
              paddingRight: spacing.lg + insets.right,
              gap: spacing.md,
            }}
          >
            {filteredSymptoms
              .filter((symptom) => {
                const label = symptom.symptom_label?.toLowerCase() ?? "";
                const category = symptom.category?.toLowerCase() ?? "";
                return !label.includes("not sure") && category !== "unknown";
              })
              .map((symptom) => {
              const education = symptomEducation.find((e) => e.symptom_key === symptom.symptom_key);
              const isExpanded = expandedGuide === symptom.symptom_key;
              const riskColor = getRiskColor(symptom.risk_level);
              const safetyColor = education ? getSafetyColor(education.is_it_safe) : "#10b981";

              return (
                <Pressable
                  key={symptom.symptom_key}
                  onPress={() => education && toggleGuide(symptom.symptom_key)}
                  style={[
                    card,
                    {
                      padding: spacing.md,
                      borderWidth: isExpanded ? 2 : 0,
                      borderColor: isExpanded ? colors.accent : "transparent",
                    },
                  ]}
                >
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: spacing.sm,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                      <Text style={{ fontSize: normalize(32) }}>{symptom.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={textStyles.section} numberOfLines={1}>
                          {symptom.symptom_label}
                        </Text>
                        <Text style={{ ...textStyles.caption, marginTop: 2 }}>{symptom.category}</Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: normalize(10),
                        paddingVertical: normalize(5),
                        borderRadius: normalize(12),
                        backgroundColor: riskColor + "20",
                      }}
                    >
                      <Text style={{ fontSize: normalize(10), fontWeight: "900", color: riskColor }}>
                        {symptom.risk_level.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text
                    style={{
                      ...textStyles.muted,
                      lineHeight: normalize(20),
                      marginBottom: spacing.sm,
                    }}
                  >
                    {symptom.customer_explainer}
                  </Text>

                  {/* Education Content */}
                  {education && (
                    <>
                      {/* Quick Info Pills */}
                      {!isExpanded && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: normalize(6) }}>
                          <View
                            style={{
                              paddingHorizontal: normalize(10),
                              paddingVertical: normalize(6),
                              borderRadius: normalize(12),
                              backgroundColor: safetyColor + "15",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: normalize(4),
                            }}
                          >
                            <Text style={{ fontSize: normalize(16) }}>🛟</Text>
                            <Text style={{ fontSize: normalize(11), fontWeight: "700", color: safetyColor }}>
                              Safety Info
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: normalize(10),
                              paddingVertical: normalize(6),
                              borderRadius: normalize(12),
                              backgroundColor: colors.accent + "15",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: normalize(4),
                            }}
                          >
                            <Text style={{ fontSize: normalize(16) }}>✅</Text>
                            <Text style={{ fontSize: normalize(11), fontWeight: "700", color: colors.accent }}>
                              Inspection Details
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: normalize(10),
                              paddingVertical: normalize(6),
                              borderRadius: normalize(12),
                              backgroundColor: colors.textMuted + "15",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: normalize(4),
                            }}
                          >
                            <Text style={{ fontSize: normalize(16) }}>💵</Text>
                            <Text style={{ fontSize: normalize(11), fontWeight: "700", color: colors.textMuted }}>
                              Pricing Guide
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <View
                          style={{
                            paddingTop: spacing.md,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            gap: spacing.md,
                          }}
                        >
                          {/* Safety */}
                          <View
                            style={{
                              padding: spacing.sm,
                              borderRadius: normalize(12),
                              backgroundColor: safetyColor + "10",
                              borderLeftWidth: 4,
                              borderLeftColor: safetyColor,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 6 }}>
                              <Text style={{ fontSize: normalize(18) }}>🛟</Text>
                              <Text style={{ ...textStyles.body, fontSize: normalize(13), fontWeight: "800" }}>
                                Is it safe to drive?
                              </Text>
                            </View>
                            <Text style={{ ...textStyles.muted, fontSize: normalize(12), lineHeight: normalize(18) }}>
                              {education.is_it_safe}
                            </Text>
                          </View>

                          {/* What We Check */}
                          <View
                            style={{
                              padding: spacing.sm,
                              borderRadius: normalize(12),
                              backgroundColor: colors.accent + "10",
                              borderLeftWidth: 4,
                              borderLeftColor: colors.accent,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 6 }}>
                              <Text style={{ fontSize: normalize(18) }}>✅</Text>
                              <Text style={{ ...textStyles.body, fontSize: normalize(13), fontWeight: "800" }}>
                                What we'll check
                              </Text>
                            </View>
                            <Text style={{ ...textStyles.muted, fontSize: normalize(12), lineHeight: normalize(18) }}>
                              {education.what_we_check}
                            </Text>
                          </View>

                          {/* Pricing */}
                          <View
                            style={{
                              padding: spacing.sm,
                              borderRadius: normalize(12),
                              backgroundColor: colors.textMuted + "10",
                              borderLeftWidth: 4,
                              borderLeftColor: colors.textMuted,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 6 }}>
                              <Text style={{ fontSize: normalize(18) }}>💵</Text>
                              <Text style={{ ...textStyles.body, fontSize: normalize(13), fontWeight: "800" }}>
                                How quotes work
                              </Text>
                            </View>
                            <Text style={{ ...textStyles.muted, fontSize: normalize(12), lineHeight: normalize(18) }}>
                              {education.how_quotes_work}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Tap to expand hint - always show when education exists */}
                      {!isExpanded && (
                        <View
                          style={{
                            marginTop: spacing.sm,
                            paddingTop: spacing.sm,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ ...textStyles.caption, color: colors.accent }}>
                            Tap to see full details ›
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Show message if no education data */}
                  {!education && (
                    <View
                      style={{
                        marginTop: spacing.sm,
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ ...textStyles.caption }}>
                        Detailed guide coming soon
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {filteredSymptoms.length === 0 && (
              <View style={[card, { padding: spacing.xl, alignItems: "center" }]}>
                <Text style={{ fontSize: normalize(48), marginBottom: spacing.sm }}>🔍</Text>
                <Text style={{ ...textStyles.body, textAlign: "center", marginBottom: spacing.xs }}>
                  No symptoms found
                </Text>
                <Text style={{ ...textStyles.muted, textAlign: "center" }}>
                  Try selecting a different category
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
