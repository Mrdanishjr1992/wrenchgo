import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { normalize } from "../../src/ui/theme";
import { createCard } from "../../src/ui/styles";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type EducationCard = {
  id: string;
  symptom_key: string;
  card_key: string;
  title: string;
  summary: string;
  is_it_safe: string;
  order_index: number;
  what_we_check?: string;
  how_quotes_work?: string;
  what_to_prepare?: string;
  quote_strategy?: string;
};

type SymptomMapping = {
  id: string;
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  customer_explainer: string;
};

export default function EducationPage() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const textStyles = useMemo(
    () => ({
      title: { fontSize: normalize(24), fontWeight: "900" as const, color: colors.textPrimary },
      section: { fontSize: normalize(16), fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: normalize(14), fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: normalize(13), fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [educationCards, setEducationCards] = useState<EducationCard[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomMapping[]>([]);
  const [activeTab, setActiveTab] = useState<"symptoms" | "guides">("symptoms");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [eduCardsRes, symptomsRes] = await Promise.all([
        supabase
          .from("education_cards")
          .select("id,symptom_key,card_key,title,summary,is_it_safe,order_index")
          .order("order_index"),
        supabase
          .from("symptom_mappings")
          .select("id,symptom_key,symptom_label,category,risk_level,customer_explainer")
          .order("symptom_label"),
      ]);

      if (eduCardsRes.error) throw eduCardsRes.error;
      if (symptomsRes.error) throw symptomsRes.error;

      setEducationCards((eduCardsRes.data as EducationCard[]) ?? []);
      setSymptoms((symptomsRes.data as SymptomMapping[]) ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TabButton = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: normalize(12),
        backgroundColor: active ? colors.accent : "transparent",
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontWeight: "900",
          fontSize: normalize(14),
          color: active ? "#fff" : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

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

      <View
        style={{
          flexDirection: "row",
          padding: spacing.md,
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TabButton label="Symptoms" active={activeTab === "symptoms"} onPress={() => setActiveTab("symptoms")} />
        <TabButton label="Guides" active={activeTab === "guides"} onPress={() => setActiveTab("guides")} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.lg + insets.bottom,
            gap: spacing.md,
          }}
        >
          {activeTab === "symptoms" ? (
            <>
              <Text style={textStyles.muted}>Learn about common car issues and what they mean</Text>

              {symptoms.map((symptom) => {
                const riskColor =
                  symptom.risk_level === "high"
                    ? "#ef4444"
                    : symptom.risk_level === "medium"
                    ? "#f59e0b"
                    : "#10b981";

                return (
                  <View key={symptom.id} style={[card, { padding: spacing.md }]}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: spacing.sm,
                      }}
                    >
                      <Text style={{ ...textStyles.section, flex: 1 }} numberOfLines={1}>
                        {symptom.symptom_label}
                      </Text>

                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(8),
                          backgroundColor: riskColor + "22",
                          marginLeft: normalize(6),
                        }}
                      >
                        <Text style={{ fontSize: normalize(10), fontWeight: "900", color: riskColor }}>
                          {symptom.risk_level.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ ...textStyles.muted, fontSize: normalize(13), lineHeight: normalize(18) }}>
                      {symptom.customer_explainer}
                    </Text>

                    <View
                      style={{
                        marginTop: spacing.sm,
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <Text style={{ ...textStyles.muted, fontSize: normalize(11) }}>
                        Category: {symptom.category}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <Text style={textStyles.muted}>Educational guides to help you understand your car better</Text>

              {educationCards.map((eduCard) => {
                const lower = eduCard.is_it_safe?.toLowerCase?.() ?? "";
                const safetyColor = lower.includes("safe")
                  ? "#10b981"
                  : lower.includes("not")
                  ? "#ef4444"
                  : "#f59e0b";

                return (
                  <View key={eduCard.id} style={[card, { padding: spacing.md }]}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: spacing.sm,
                        marginBottom: spacing.xs,
                      }}
                    >
                      <Text style={{ ...textStyles.section, flex: 1, flexShrink: 1 }} numberOfLines={2}>
                        {eduCard.title}
                      </Text>

                      <View
                        style={{
                          width: normalize(10),
                          height: normalize(10),
                          borderRadius: normalize(5),
                          backgroundColor: safetyColor,
                          flexShrink: 0,
                        }}
                      />
                    </View>

                    <Text
                      style={{
                        ...textStyles.muted,
                        fontSize: normalize(13),
                        lineHeight: normalize(18),
                        marginBottom: spacing.sm,
                      }}
                      numberOfLines={3}
                    >
                      {eduCard.summary}
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: normalize(6), marginBottom: spacing.sm }}>
                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(8),
                          backgroundColor: colors.accent + "15",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: normalize(4),
                          flexShrink: 1,
                        }}
                      >
                        <Text style={{ fontSize: normalize(11), fontWeight: "700", color: colors.accent }} numberOfLines={1}>
                          ✅ What we'll check
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(8),
                          backgroundColor: safetyColor + "15",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: normalize(4),
                          flexShrink: 1,
                        }}
                      >
                        <Text style={{ fontSize: normalize(11), fontWeight: "700", color: safetyColor }} numberOfLines={1}>
                          🛟 Is it safe?
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(8),
                          backgroundColor: colors.textMuted + "15",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: normalize(4),
                          flexShrink: 1,
                        }}
                      >
                        <Text style={{ fontSize: normalize(11), fontWeight: "700", color: colors.textMuted }} numberOfLines={1}>
                          💵 How quotes work
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(8),
                          backgroundColor: colors.textMuted + "15",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: normalize(4),
                          flexShrink: 1,
                        }}
                      >
                        <Text style={{ fontSize: normalize(11), fontWeight: "700", color: colors.textMuted }} numberOfLines={1}>
                          📸 What to prepare
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ ...textStyles.muted, fontSize: normalize(11), flex: 1, flexShrink: 1, marginRight: normalize(6) }}
                        numberOfLines={2}
                      >
                        {eduCard.is_it_safe}
                      </Text>

                      <View
                        style={{
                          paddingHorizontal: normalize(8),
                          paddingVertical: normalize(4),
                          borderRadius: normalize(6),
                          backgroundColor: colors.accent + "22",
                          flexShrink: 0,
                        }}
                      >
                        <Text style={{ fontSize: normalize(10), fontWeight: "900", color: colors.accent }} numberOfLines={1}>
                          {eduCard.symptom_key.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
