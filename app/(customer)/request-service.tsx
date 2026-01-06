import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { spacing } from "../../src/ui/theme";

type Question = {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
};

// Fallback flows (only used if DB doesn’t return questions)
type QuestionFlow = { [key: string]: Question[] };

const QUESTION_FLOWS: QuestionFlow = {
  wont_start: [
    {
      id: "key_turn_result",
      question: "What happens when you turn the key?",
      type: "choice",
      options: ["Nothing at all", "Clicking sound", "Engine cranks but won’t start", "Starts then dies", "Not sure"],
    },
    {
      id: "dashboard_lights",
      question: "Are your dashboard lights working?",
      type: "choice",
      options: ["Yes, normal", "Dim or flickering", "Not working", "Not sure"],
    },
  ],
  strange_noise: [
    {
      id: "noise_type",
      question: "What kind of noise?",
      type: "choice",
      options: ["Squealing", "Grinding", "Knocking", "Rattling", "Humming", "Other"],
    },
    {
      id: "when_hear",
      question: "When do you hear it?",
      type: "choice",
      options: ["When starting", "While driving", "When turning", "When braking", "All the time"],
    },
  ],
  warning_light: [
    {
      id: "which_light",
      question: "Which warning light is on?",
      type: "choice",
      options: ["Check Engine", "ABS/Brake", "Oil pressure", "Battery", "Other/Multiple"],
    },
    {
      id: "solid_or_flashing",
      question: "Is the light solid or flashing?",
      type: "choice",
      options: ["Solid", "Flashing", "Not sure"],
    },
  ],
  fluid_leak: [
    {
      id: "fluid_color",
      question: "What color is the fluid?",
      type: "choice",
      options: ["Clear/water", "Green/yellow", "Red/pink", "Brown/black", "Not sure"],
    },
    {
      id: "puddle_location",
      question: "Where is the puddle?",
      type: "choice",
      options: ["Front of car", "Middle", "Back", "Not sure"],
    },
  ],
  battery_issues: [
    {
      id: "battery_symptom",
      question: "What’s happening?",
      type: "choice",
      options: ["Slow to start", "Won’t hold charge", "Electrical issues", "Battery light on", "Not sure"],
    },
    {
      id: "battery_age",
      question: "How old is your battery?",
      type: "choice",
      options: ["Less than 2 years", "2–4 years", "4+ years", "Not sure"],
    },
  ],
  maintenance: [
    {
      id: "service_needed",
      question: "What service do you need?",
      type: "choice",
      options: ["Oil change", "Tire rotation", "Brake inspection", "Full service", "Other", "Not sure"],
    },
  ],
  not_sure: [
    {
      id: "concern_reason",
      question: "What made you concerned?",
      type: "choice",
      options: ["Something feels off", "Preventive check", "Recent issue", "Other"],
    },
  ],
};

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export default function RequestService() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{
    symptom?: string;
    vehicleId?: string;
    vehicleYear?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleNickname?: string;
  }>();

  const symptomKey = safeString(params.symptom);
  const vehicleId = safeString(params.vehicleId);

  const vehicleSummary = useMemo(() => {
    const year = safeString(params.vehicleYear);
    const make = safeString(params.vehicleMake);
    const model = safeString(params.vehicleModel);
    const nick = safeString(params.vehicleNickname);
    const name = [year, make, model].filter(Boolean).join(" ");
    return nick ? `${name} (${nick})` : name;
  }, [params.vehicleYear, params.vehicleMake, params.vehicleModel, params.vehicleNickname]);

  const [userId, setUserId] = useState<string | null>(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [symptomLabel, setSymptomLabel] = useState<string | null>(null);

  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Steps:
  // - if coming from explorer with symptomKey: start at questions (or details if no questions)
  // - otherwise: show a friendly “no symptom selected” state
  const [step, setStep] = useState<"questions" | "details">("questions");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [location, setLocation] = useState("");
  const [savedLat, setSavedLat] = useState<number | null>(null);
  const [savedLng, setSavedLng] = useState<number | null>(null);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);

  // Typography helpers
  const text = useMemo(
    () => ({
      h2: { fontSize: 22, fontWeight: "900" as const, color: colors.textPrimary },
      h3: { fontSize: 18, fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: 16, fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: 13, fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("getSession error:", error);
      }
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
        // Check if user has payment method in customer_payment_methods table
        const { data: paymentMethods } = await supabase
          .from("customer_payment_methods")
          .select("id")
          .eq("customer_id", data.session.user.id)
          .is("deleted_at", null)
          .limit(1);
        setHasPaymentMethod(paymentMethods && paymentMethods.length > 0);
      } else {
        router.replace("/(auth)/sign-in");
      }
    };
    getUser();
  }, []);

  const fetchQuestionsFromDB = useCallback(async (symptom: string) => {
    setLoadingQuestions(true);
    try {
      // Pull questions from your seed-driven tables
      const { data, error } = await supabase
        .from("symptom_questions")
        .select("question_key, question_text, question_type, options, display_order")
        .eq("symptom_key", symptom)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const dbQuestions: Question[] =
        (data ?? []).map((q: any) => {
          let opts: string[] | undefined;

          // Your seed uses jsonb array like ["A","B"]
          if (Array.isArray(q.options)) {
            opts = q.options;
          } else if (typeof q.options === "string") {
            // just in case it comes back stringified
            try {
              const parsed = JSON.parse(q.options);
              if (Array.isArray(parsed)) opts = parsed;
            } catch {
              // ignore
            }
          }

          // question_type in DB might be "single_choice" / "multi_choice" / "text" / "yes_no"
          const t = String(q.question_type ?? "").toLowerCase();
          const type: "choice" | "text" = t.includes("text") ? "text" : "choice";

          // Handle yes_no questions
          if (t === "yes_no" && (!opts || opts.length === 0)) {
            opts = ["Yes", "No"];
          }

          return {
            id: String(q.question_key),
            question: String(q.question_text),
            type,
            options: type === "choice" ? opts ?? [] : undefined,
          };
        }) ?? [];

      if (dbQuestions.length > 0) {
        setQuestions(dbQuestions);
      } else {
        // fallback
        setQuestions(QUESTION_FLOWS[symptom] ?? []);
      }
    } catch (e: any) {
      console.error("Failed to load questions:", e?.message ?? e);
      // fallback
      setQuestions(QUESTION_FLOWS[symptom] ?? []);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // Initialize flow based on symptomKey
  useEffect(() => {
    if (!symptomKey) return;

    setAnswers({});
    setAdditionalDetails("");
    setLocation("");
    setCurrentQuestionIndex(0);

    fetchQuestionsFromDB(symptomKey);

    // Fetch symptom label
    (async () => {
      const { data } = await supabase
        .from("symptoms")
        .select("label")
        .eq("key", symptomKey)
        .single();
      if (data?.label) {
        setSymptomLabel(data.label);
      }
    })();
  }, [symptomKey, fetchQuestionsFromDB]);

  // If no questions, jump to details after load
  useEffect(() => {
    if (!symptomKey) return;
    if (loadingQuestions) return;

    if (questions.length === 0) setStep("details");
    else setStep("questions");
  }, [questions.length, loadingQuestions, symptomKey]);

  const currentQuestion = questions[currentQuestionIndex];

  const canGoNextTextQuestion = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type !== "text") return false;
    return Boolean((answers[currentQuestion.id] ?? "").trim());
  }, [answers, currentQuestion]);

  const handleBack = useCallback(() => {
    if (step === "details") {
      if (questions.length > 0) {
        setStep("questions");
        setCurrentQuestionIndex(Math.max(0, questions.length - 1));
        return;
      }
      router.back();
      return;
    }

    if (step === "questions") {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex((i) => i - 1);
      } else {
        router.back();
      }
    }
  }, [step, questions.length, currentQuestionIndex]);

  const handleAnswerSelect = useCallback(
    (answer: string) => {
      if (!currentQuestion) return;

      const next = { ...answers, [currentQuestion.id]: answer };
      setAnswers(next);

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((i) => i + 1);
      } else {
        setStep("details");
      }
    },
    [answers, currentQuestion, currentQuestionIndex, questions.length]
  );

  const generateProblemDescription = useCallback((): string => {
    const answerTexts = Object.entries(answers)
      .map(([, v]) => v)
      .filter(Boolean);

    let description = symptomKey ? `Symptom: ${symptomKey}\n` : "";
    if (vehicleSummary) description += `Vehicle: ${vehicleSummary}\n`;

    if (answerTexts.length > 0) {
      description += `\nAnswers:\n- ${answerTexts.join("\n- ")}`;
    }

    if (additionalDetails.trim()) {
      description += `\n\nAdditional details:\n${additionalDetails.trim()}`;
    }

    return description.trim();
  }, [answers, additionalDetails, symptomKey, vehicleSummary]);

  const handleSubmit = useCallback(async () => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to request service.");
      return;
    }
    if (!hasPaymentMethod) {
      Alert.alert(
        "Payment Required",
        "Please add a payment method before requesting service.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Payment", onPress: () => router.push("/(customer)/(tabs)/account") },
        ]
      );
      return;
    }
    if (!symptomKey) {
      Alert.alert("Missing info", "Please select a symptom first.");
      return;
    }
    if (!vehicleId) {
      Alert.alert("Missing info", "Please select a vehicle first.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Missing Information", "Please enter your location.");
      return;
    }

    setLoadingSubmit(true);

    try {
      const description = generateProblemDescription();

      // Geocode the address to get lat/lng
      let locationLat: number | null = null;
      let locationLng: number | null = null;

      try {
        // Append USA for better geocoding of zip codes
        const searchLocation = /^\d{5}$/.test(location.trim())
          ? `${location.trim()}, USA`
          : location.trim();
        const geocoded = await Location.geocodeAsync(searchLocation);
        if (geocoded && geocoded.length > 0) {
          locationLat = geocoded[0].latitude;
          locationLng = geocoded[0].longitude;
        }
        console.log('Geocoded', searchLocation, 'to', locationLat, locationLng);
      } catch (geoError) {
        console.warn("Geocoding failed:", geoError);
      }

      const { error } = await supabase
        .from("jobs")
        .insert({
          customer_id: userId,
          title: symptomLabel || symptomKey || "Service Request",
          description,
          location_address: location.trim(),
          location_lat: locationLat,
          location_lng: locationLng,
          status: "searching",
          vehicle_id: vehicleId,
          symptom_id: null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        "Sent!",
        "Your request has been sent to mechanics in your area. You’ll receive quotes soon.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Error submitting request:", error);
      Alert.alert("Error", error.message || "Failed to submit request");
    } finally {
      setLoadingSubmit(false);
    }
  }, [userId, hasPaymentMethod, symptomKey, symptomLabel, vehicleId, location, generateProblemDescription]);

  const renderTopHeader = () => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <TouchableOpacity onPress={handleBack} style={{ marginRight: spacing.md }}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={{ ...text.h3, flex: 1 }}>Request Service</Text>
    </View>
  );

  const renderProgress = () => {
    if (step !== "questions" || questions.length <= 1) return null;

    return (
      <View style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
          {questions.map((_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 4,
                backgroundColor: index <= currentQuestionIndex ? colors.accent : colors.border,
                marginHorizontal: 2,
                borderRadius: 2,
              }}
            />
          ))}
        </View>
        <Text style={text.muted}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
      </View>
    );
  };

  const renderQuestions = () => {
    if (!symptomKey) {
      return (
        <View style={{ padding: spacing.lg }}>
          <Text style={text.h2}>Pick a symptom first</Text>
          <Text style={[text.muted, { marginTop: spacing.sm }]}>
            Go back to Explore and select the symptom that best matches your issue.
          </Text>
        </View>
      );
    }

    if (loadingQuestions) {
      return (
        <View style={{ padding: spacing.xl, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: spacing.md, ...text.muted }}>Loading questions…</Text>
        </View>
      );
    }

    if (!currentQuestion) {
      // No questions — handled by step jump to details, but keep safe fallback
      return (
        <View style={{ padding: spacing.lg }}>
          <Text style={text.h2}>A few quick details</Text>
          <Text style={[text.muted, { marginTop: spacing.sm }]}>
            We’ll use this to match you with the right mechanic.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* Context cards */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ ...text.body, fontWeight: "900" }}>Vehicle</Text>
          <Text style={[text.muted, { marginTop: 4 }]} numberOfLines={2}>
            {vehicleSummary || "Not selected"}
          </Text>

          <View style={{ height: 12 }} />

          <Text style={{ ...text.body, fontWeight: "900" }}>Symptom</Text>
          <Text style={[text.muted, { marginTop: 4 }]}>{symptomKey}</Text>
        </View>

        {renderProgress()}

        <Text style={{ ...text.h2, marginBottom: spacing.lg }}>{currentQuestion.question}</Text>

        {currentQuestion.type === "choice" && currentQuestion.options ? (
          <View style={{ gap: spacing.sm }}>
            {currentQuestion.options.map((option) => {
              const selected = answers[currentQuestion.id] === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => handleAnswerSelect(option)}
                  style={{
                    backgroundColor: colors.surface,
                    padding: spacing.lg,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selected ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    style={{
                      ...text.body,
                      color: selected ? colors.accent : colors.textPrimary,
                      fontWeight: selected ? "900" : "700",
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                padding: spacing.lg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                minHeight: 120,
                textAlignVertical: "top",
                fontSize: 16,
                fontWeight: "600",
              }}
              placeholder="Type your answer…"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={answers[currentQuestion.id] || ""}
              onChangeText={(t) => setAnswers({ ...answers, [currentQuestion.id]: t })}
            />
          </View>
        )}
      </View>
    );
  };

  const renderDetails = () => (
    <View style={{ padding: spacing.lg, paddingBottom: 140 }}>
      <Text style={{ ...text.h2, marginBottom: spacing.sm }}>Review & send</Text>
      <Text style={{ ...text.muted, marginBottom: spacing.lg }}>
        Add your location and any extra details — then we’ll send this to nearby mechanics.
      </Text>

      <View
        style={{
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>Summary</Text>
        <Text style={{ ...text.muted, lineHeight: 18 }}>{generateProblemDescription()}</Text>
      </View>

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>Where is your vehicle located?</Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.textPrimary,
          marginBottom: spacing.lg,
          fontSize: 16,
          fontWeight: "600",
        }}
        placeholder="Address or zip code"
        placeholderTextColor={colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>
        Anything else we should know? (Optional)
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.textPrimary,
          minHeight: 110,
          textAlignVertical: "top",
          marginBottom: spacing.lg,
          fontSize: 16,
          fontWeight: "600",
        }}
        placeholder="Extra details, noises, recent work done, etc."
        placeholderTextColor={colors.textSecondary}
        multiline
        value={additionalDetails}
        onChangeText={setAdditionalDetails}
      />
    </View>
  );

  const showStickyNext =
    step === "questions" &&
    !loadingQuestions &&
    currentQuestion &&
    currentQuestion.type === "text";

  const showStickySubmit = step === "details";

  const onStickyNext = () => {
    if (!currentQuestion) return;
    const val = (answers[currentQuestion.id] ?? "").trim();
    if (!val) return;

    // behave like choice select: advance
    handleAnswerSelect(val);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {renderTopHeader()}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {step === "questions" && renderQuestions()}
          {step === "details" && renderDetails()}
        </ScrollView>

        {/* Sticky bottom CTA */}
        {showStickyNext && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: spacing.lg,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={onStickyNext}
              disabled={!canGoNextTextQuestion}
              style={{
                backgroundColor: canGoNextTextQuestion ? colors.accent : colors.border,
                padding: spacing.lg,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {showStickySubmit && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: spacing.lg,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loadingSubmit || !location.trim() || !symptomKey || !vehicleId}
              style={{
                backgroundColor:
                  loadingSubmit || !location.trim() || !symptomKey || !vehicleId ? colors.border : colors.accent,
                padding: spacing.lg,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              {loadingSubmit ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>
                  Send to mechanics
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}


