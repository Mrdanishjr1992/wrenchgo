import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInDown } from "react-native-reanimated";
import { useTheme } from "../../src/ui/theme-context";
import {
  DiagnosisResult,
  DiagnosisInput,
  ClarifyingQuestion,
  LikelyCause,
  NextStep,
  getDiagnosis,
  getSafetyMessage,
  formatDocumentationNote,
  TriageLevel,
} from "../../src/lib/aiDiagnosisService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface DiagnosisAssistantProps {
  visible: boolean;
  onClose: () => void;
  leadId: string;
  title: string;
  description: string;
  vehicleInfo?: {
    year?: number;
    make?: string;
    model?: string;
    mileage?: string;
  };
  category?: string;
  onSendMessage: (message: string) => void;
  onSaveNotes: (notes: string) => void;
}

type TabType = "questions" | "causes" | "steps" | "docs";

const TriageBadge: React.FC<{ level: TriageLevel }> = ({ level }) => {
  const { colors, spacing, radius } = useTheme();
  const config = {
    low: { bg: "#10b98120", color: "#10b981", label: "Low Risk" },
    medium: { bg: "#f59e0b20", color: "#f59e0b", label: "Medium Risk" },
    high: { bg: "#ef444420", color: "#ef4444", label: "High Risk" },
  };
  const { bg, color, label } = config[level];

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
};

const QuestionItem: React.FC<{
  question: ClarifyingQuestion;
  index: number;
  onSend: () => void;
  onToggleAnswered: () => void;
}> = ({ question, index, onSend, onToggleAnswered }) => {
  const { colors, spacing, radius, text } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: question.answered ? colors.accent + "40" : colors.border,
      }}
    >
      <Text style={{ ...text.body, fontSize: 15, marginBottom: spacing.xs }}>{question.text}</Text>
      <Text style={{ ...text.muted, fontSize: 12, marginBottom: spacing.sm }}>{question.why}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={onSend}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: colors.accent,
            paddingVertical: 10,
            borderRadius: radius.sm,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="send" size={14} color="#000" />
          <Text style={{ color: "#000", fontWeight: "600", fontSize: 13 }}>Send to Customer</Text>
        </Pressable>
        <Pressable
          onPress={onToggleAnswered}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: question.answered ? colors.accent + "20" : colors.bg,
            paddingVertical: 10,
            paddingHorizontal: spacing.md,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: question.answered ? colors.accent : colors.border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons
            name={question.answered ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={question.answered ? colors.accent : colors.textMuted}
          />
          <Text style={{ color: question.answered ? colors.accent : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
            {question.answered ? "Answered" : "Mark"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const CauseItem: React.FC<{ cause: LikelyCause; index: number }> = ({ cause, index }) => {
  const { colors, spacing, radius, text } = useTheme();
  const confidenceConfig = {
    high: { bg: "#10b98120", color: "#10b981", label: "Most Likely" },
    medium: { bg: "#f59e0b20", color: "#f59e0b", label: "Possible" },
    low: { bg: "#6b728020", color: "#6b7280", label: "Needs Inspection" },
  };
  const { bg, color, label } = confidenceConfig[cause.confidence];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
        <Text style={{ ...text.body, fontWeight: "700", fontSize: 15, flex: 1 }}>{cause.label}</Text>
        <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm }}>
          <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
        </View>
      </View>
      <Text style={{ ...text.muted, fontSize: 13 }}>{cause.reason}</Text>
    </Animated.View>
  );
};

const StepItem: React.FC<{ step: NextStep; index: number; onAction?: () => void }> = ({ step, index, onAction }) => {
  const { colors, spacing, radius, text } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.accent + "20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...text.body, fontWeight: "600", fontSize: 15, marginBottom: 4 }}>{step.action}</Text>
          <Text style={{ ...text.muted, fontSize: 13, marginBottom: spacing.xs }}>{step.reason}</Text>
          {step.requires_inspection && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="location" size={12} color={colors.textMuted} />
              <Text style={{ ...text.muted, fontSize: 11 }}>Requires on-site inspection</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export const DiagnosisAssistant: React.FC<DiagnosisAssistantProps> = ({
  visible,
  onClose,
  leadId,
  title,
  description,
  vehicleInfo,
  category,
  onSendMessage,
  onSaveNotes,
}) => {
  const { colors, spacing, radius, text } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("questions");
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const loadDiagnosis = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const input: DiagnosisInput = {
        leadId,
        title,
        description,
        category,
        vehicleInfo,
      };
      const result = await getDiagnosis(input, forceRefresh);
      setDiagnosis(result);
      setQuestions(result.clarifying_questions.map((q) => ({ ...q, answered: false })));
    } catch (e: any) {
      setError(e?.message || "Failed to load diagnosis");
    } finally {
      setLoading(false);
    }
  }, [leadId, title, description, category, vehicleInfo]);

  useEffect(() => {
    if (visible) {
      loadDiagnosis();
    }
  }, [visible, loadDiagnosis]);

  const handleSendQuestion = (question: ClarifyingQuestion) => {
    onSendMessage(question.text);
    Alert.alert("Question Copied", "The question has been added to your message composer.");
  };

  const handleToggleAnswered = (index: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, answered: !q.answered } : q))
    );
  };

  const handleSaveDocumentation = () => {
    if (!diagnosis) return;
    const notes = formatDocumentationNote(diagnosis.documentation_template, findings, recommendation);
    onSaveNotes(notes);
    Alert.alert("Notes Saved", "Documentation has been saved to the lead record.");
  };

  const handleSendSafetyMessage = () => {
    if (!diagnosis) return;
    const message = getSafetyMessage(diagnosis.triage_level);
    if (message) {
      onSendMessage(message);
      Alert.alert("Safety Message Copied", "The safety warning has been added to your message composer.");
    }
  };

  const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "questions", label: "Questions", icon: "help-circle" },
    { key: "causes", label: "Causes", icon: "search" },
    { key: "steps", label: "Next Steps", icon: "list" },
    { key: "docs", label: "Document", icon: "document-text" },
  ];

  const vehicleText = vehicleInfo
    ? `${vehicleInfo.year || ""} ${vehicleInfo.make || ""} ${vehicleInfo.model || ""}`.trim()
    : null;

  // Parse description if it's JSON
  const formatDescription = (desc: string): string => {
    if (!desc) return "";
    try {
      const parsed = JSON.parse(desc);
      if (typeof parsed === "object") {
        const parts: string[] = [];

        // Get symptom label
        if (parsed.symptom?.label) {
          parts.push(parsed.symptom.label);
        }

        // Get context details
        if (parsed.context) {
          if (parsed.context.additional_details) {
            parts.push(parsed.context.additional_details);
          }
          if (parsed.context.location_type) {
            parts.push(`Location: ${parsed.context.location_type}`);
          }
          if (parsed.context.can_move === "no") {
            parts.push("Vehicle cannot be moved");
          }
        }

        // Get answers - format as readable text
        if (parsed.answers && typeof parsed.answers === "object") {
          Object.entries(parsed.answers).forEach(([key, val]) => {
            if (typeof val === "string" && val.length > 0 && val !== "null") {
              // Clean up the key for display
              const cleanKey = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              parts.push(`${cleanKey}: ${val}`);
            }
          });
        }

        if (parts.length > 0) {
          return parts.join("\n");
        }
      }
      return desc;
    } catch {
      return desc;
    }
  };

  const displayDescription = formatDescription(description);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Animated.View
          entering={SlideInDown}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: SCREEN_HEIGHT * 0.9,
            paddingBottom: insets.bottom,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.accent + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="pulse" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={{ ...text.body, fontWeight: "700", fontSize: 17 }}>Diagnosis Assistant</Text>
                <Text style={{ ...text.muted, fontSize: 12 }}>AI-powered triage</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pressable
                onPress={() => loadDiagnosis(true)}
                style={({ pressed }) => ({
                  padding: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="refresh" size={22} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  padding: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={{ padding: spacing.xl, alignItems: "center", justifyContent: "center", minHeight: 300 }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ ...text.muted, marginTop: spacing.md }}>Analyzing symptoms...</Text>
            </View>
          ) : error ? (
            <View style={{ padding: spacing.xl, alignItems: "center", justifyContent: "center", minHeight: 300 }}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
              <Text style={{ ...text.body, marginTop: spacing.md, textAlign: "center" }}>{error}</Text>
              <Pressable
                onPress={() => loadDiagnosis(true)}
                style={{
                  marginTop: spacing.md,
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "600" }}>Retry</Text>
              </Pressable>
            </View>
          ) : diagnosis ? (
            <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.75 }}>
              {/* Lead Summary */}
              <View style={{ padding: spacing.md, backgroundColor: colors.surface, margin: spacing.md, borderRadius: radius.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "700", fontSize: 15 }} numberOfLines={2}>
                      {title || "Customer Issue"}
                    </Text>
                    {vehicleText && <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>{vehicleText}</Text>}
                    {vehicleInfo?.mileage && (
                      <Text style={{ ...text.muted, fontSize: 12 }}>{vehicleInfo.mileage} miles</Text>
                    )}
                  </View>
                  <TriageBadge level={diagnosis.triage_level} />
                </View>
                <Text style={{ ...text.muted, fontSize: 13 }} numberOfLines={3}>
                  {displayDescription}
                </Text>
              </View>

              {/* Safety Banner */}
              {diagnosis.triage_level === "high" && (
                <Animated.View
                  entering={FadeIn}
                  style={{
                    backgroundColor: "#ef444420",
                    marginHorizontal: spacing.md,
                    marginBottom: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderLeftWidth: 4,
                    borderLeftColor: "#ef4444",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 15 }}>Safety Risk Detected</Text>
                  </View>
                  <Text style={{ ...text.body, fontSize: 13, marginBottom: spacing.sm }}>
                    Recommend tow / do not drive until inspected
                  </Text>
                  <Pressable
                    onPress={handleSendSafetyMessage}
                    style={({ pressed }) => ({
                      backgroundColor: "#ef4444",
                      paddingVertical: 10,
                      borderRadius: radius.sm,
                      alignItems: "center",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Send Safety Message</Text>
                  </Pressable>
                </Animated.View>
              )}

              {/* Tabs */}
              <View
                style={{
                  flexDirection: "row",
                  marginHorizontal: spacing.md,
                  marginBottom: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: 4,
                }}
              >
                {tabs.map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      paddingVertical: 10,
                      borderRadius: radius.sm,
                      backgroundColor: activeTab === tab.key ? colors.accent : "transparent",
                    }}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={activeTab === tab.key ? "#000" : colors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: activeTab === tab.key ? "#000" : colors.textMuted,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Tab Content */}
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
                {activeTab === "questions" && (
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12, marginBottom: spacing.sm }}>
                      Tap to send questions to the customer
                    </Text>
                    {questions.map((q, i) => (
                      <QuestionItem
                        key={i}
                        question={q}
                        index={i}
                        onSend={() => handleSendQuestion(q)}
                        onToggleAnswered={() => handleToggleAnswered(i)}
                      />
                    ))}
                  </View>
                )}

                {activeTab === "causes" && (
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12, marginBottom: spacing.sm }}>
                      Possible causes based on symptoms (not a diagnosis)
                    </Text>
                    {diagnosis.likely_causes.map((cause, i) => (
                      <CauseItem key={i} cause={cause} index={i} />
                    ))}
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        padding: spacing.md,
                        borderRadius: radius.md,
                        marginTop: spacing.sm,
                      }}
                    >
                      <Text style={{ ...text.muted, fontSize: 11, fontStyle: "italic", textAlign: "center" }}>
                        Remote triage only — confirm on inspection
                      </Text>
                    </View>
                  </View>
                )}

                {activeTab === "steps" && (
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12, marginBottom: spacing.sm }}>
                      Recommended diagnostic steps
                    </Text>
                    {diagnosis.next_steps.map((step, i) => (
                      <StepItem key={i} step={step} index={i} />
                    ))}
                  </View>
                )}

                {activeTab === "docs" && (
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12, marginBottom: spacing.sm }}>
                      Generate dispute-proof documentation
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        marginBottom: spacing.md,
                      }}
                    >
                      <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.xs }}>Customer Complaint</Text>
                      <Text style={{ ...text.muted, fontSize: 13 }}>{diagnosis.documentation_template.complaint || displayDescription}</Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        marginBottom: spacing.md,
                      }}
                    >
                      <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.sm }}>Checks to Perform</Text>
                      {diagnosis.documentation_template.checks.map((check, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 }}>
                          <Ionicons name="square-outline" size={18} color={colors.textMuted} />
                          <Text style={{ ...text.body, fontSize: 14 }}>{check}</Text>
                        </View>
                      ))}
                    </View>

                    <Pressable
                      onPress={handleSaveDocumentation}
                      style={({ pressed }) => ({
                        backgroundColor: colors.accent,
                        paddingVertical: 14,
                        borderRadius: radius.md,
                        alignItems: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>Save Documentation to Lead</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Quote Guidance */}
              {diagnosis.quote_guidance.recommend_diagnostic_first && (
                <View
                  style={{
                    backgroundColor: "#f59e0b20",
                    marginHorizontal: spacing.md,
                    marginBottom: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                    <Ionicons name="bulb" size={18} color="#f59e0b" />
                    <Text style={{ color: "#f59e0b", fontWeight: "700", fontSize: 14 }}>Quote Tip</Text>
                  </View>
                  <Text style={{ ...text.body, fontSize: 13 }}>
                    This issue is uncertain. Consider charging a diagnostic fee first.
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
                    {diagnosis.quote_guidance.labor_range_hint}
                  </Text>
                </View>
              )}

              {/* Disclaimer */}
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
                <Text style={{ ...text.muted, fontSize: 11, textAlign: "center", fontStyle: "italic" }}>
                  {diagnosis.quote_guidance.disclaimer}
                </Text>
              </View>
            </ScrollView>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default DiagnosisAssistant;
