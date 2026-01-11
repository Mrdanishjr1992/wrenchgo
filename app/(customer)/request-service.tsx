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
import { useFocusEffect } from "@react-navigation/native";
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

// Fallback flows (only used if DB doesnâ€™t return questions)
type QuestionFlow = { [key: string]: Question[] };

const QUESTION_FLOWS: QuestionFlow = {
  wont_start: [
    {
      id: "key_turn_result",
      question: "What happens when you turn the key?",
      type: "choice",
      options: ["Nothing at all", "Clicking sound", "Engine cranks but wonâ€™t start", "Starts then dies", "Not sure"],
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
      question: "Whatâ€™s happening?",
      type: "choice",
      options: ["Slow to start", "Wonâ€™t hold charge", "Electrical issues", "Battery light on", "Not sure"],
    },
    {
      id: "battery_age",
      question: "How old is your battery?",
      type: "choice",
      options: ["Less than 2 years", "2â€“4 years", "4+ years", "Not sure"],
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
  // - otherwise: show a friendly â€œno symptom selectedâ€ state
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
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [canMove, setCanMove] = useState<string | null>(null);
  const [vehicleLocation, setVehicleLocation] = useState<string | null>(null);
  const [timePreference, setTimePreference] = useState<string | null>(null);

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

  const checkPaymentStatus = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("payment_method_status")
        .eq("id", data.session.user.id)
        .single();
      setHasPaymentMethod(profile?.payment_method_status === 'active');
    }
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("getSession error:", error);
      }
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
        await checkPaymentStatus();
      } else {
        router.replace("/(auth)/sign-in");
      }
    };
    getUser();
  }, [checkPaymentStatus]);

  useFocusEffect(
    useCallback(() => {
      checkPaymentStatus();
    }, [checkPaymentStatus])
  );

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
        // fallback to hardcoded questions
        const fallback = QUESTION_FLOWS[symptom] ?? [];
        if (fallback.length > 0) {
          setQuestions(fallback);
        } else {
          // No questions at all - skip to details
          setQuestions([]);
          setStep("details");
        }
      }
    } catch (e: any) {
      console.error("Failed to load questions:", e?.message ?? e);
      // fallback
      const fallback = QUESTION_FLOWS[symptom] ?? [];
      if (fallback.length > 0) {
        setQuestions(fallback);
      } else {
        setQuestions([]);
        setStep("details");
      }
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

  // Get current location when reaching details step
  useEffect(() => {
    if (step === "details" && !savedLat && !savedLng && !loadingLocation) {
      getCurrentLocation();
    }
  }, [step, savedLat, savedLng, loadingLocation]);

  const getCurrentLocation = async () => {
    setLoadingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied");
        setLoadingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      setSavedLat(latitude);
      setSavedLng(longitude);

      // Reverse geocode to get address
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const addressStr = [
            addr.street,
            addr.city,
            addr.region,
            addr.postalCode,
          ]
            .filter(Boolean)
            .join(", ");
          setSavedAddress(addressStr);
          setLocation(addressStr);
        }
      } catch (e) {
        console.warn("Reverse geocoding failed:", e);
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationError("Failed to get location");
    } finally {
      setLoadingLocation(false);
    }
  };

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
    const intake = {
      symptom: symptomKey ? { key: symptomKey, label: symptomLabel || symptomKey } : undefined,
      vehicle: vehicleId ? {
        id: vehicleId,
        year: parseInt(safeString(params.vehicleYear)) || 0,
        make: safeString(params.vehicleMake),
        model: safeString(params.vehicleModel),
        nickname: safeString(params.vehicleNickname) || null,
      } : undefined,
      answers: Object.keys(answers).length > 0 ? answers : undefined,
      context: {
        can_move: canMove || "Not sure",
        location: vehicleLocation || "Not specified",
        time_preference: timePreference || "Flexible",
        additional_details: additionalDetails.trim() || undefined,
      },
    };
    return JSON.stringify(intake);
  }, [answers, additionalDetails, symptomKey, symptomLabel, vehicleId, params.vehicleYear, params.vehicleMake, params.vehicleModel, params.vehicleNickname, canMove, vehicleLocation, timePreference]);

  const getHumanReadableSummary = useCallback((): string => {
    const answerTexts = Object.entries(answers)
      .map(([, v]) => v)
      .filter(Boolean);

    let summary = symptomLabel || symptomKey ? `Issue: ${symptomLabel || symptomKey}\n` : "";
    if (vehicleSummary) summary += `Vehicle: ${vehicleSummary}\n`;

    if (answerTexts.length > 0) {
      summary += `\nAnswers:\n- ${answerTexts.join("\n- ")}`;
    }

    if (additionalDetails.trim()) {
      summary += `\n\nAdditional details:\n${additionalDetails.trim()}`;
    }

    return summary.trim();
  }, [answers, additionalDetails, symptomKey, symptomLabel, vehicleSummary]);

  const handleSubmit = useCallback(async () => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to request service.");
      return;
    }

    // Fresh check of payment status before submitting
    const { data: session } = await supabase.auth.getSession();
    const { data: profile } = await supabase
      .from("profiles")
      .select("payment_method_status")
      .eq("id", session?.session?.user?.id)
      .single();
    const paymentActive = profile?.payment_method_status === 'active';

    if (!paymentActive) {
      Alert.alert(
        "Payment Required",
        "Please add a payment method before requesting service.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Payment", onPress: () => router.push("/(customer)/payment-setup?returnTo=/(customer)/request-service") },
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
    if (!location.trim() && !savedLat && !savedLng) {
      Alert.alert("Missing Information", "Please allow location access to continue.");
      return;
    }

    setLoadingSubmit(true);

    try {
      const description = generateProblemDescription();

      // Use saved location coordinates
      let locationLat: number | null = savedLat;
      let locationLng: number | null = savedLng;
      let locationAddress = savedAddress || location.trim();

      // If no saved coordinates, try geocoding the location text
      if (!locationLat || !locationLng) {
        try {
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
      }

      const { data: result, error } = await supabase.rpc('create_job_with_payment_check', {
        p_title: symptomLabel || symptomKey || "Service Request",
        p_description: description,
        p_location_address: locationAddress,
        p_location_lat: locationLat,
        p_location_lng: locationLng,
        p_vehicle_id: vehicleId,
        p_preferred_time: timePreference || null,
        p_symptom_key: symptomKey || null,
      });

      if (error) throw error;

      if (!result?.success) {
        if (result?.code === 'PAYMENT_METHOD_REQUIRED') {
          Alert.alert(
            "Payment Method Required",
            "To use this feature, please add a payment method.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Add Payment Method", onPress: () => router.push("/(customer)/payment-setup") },
            ]
          );
          return;
        }
        throw new Error(result?.message || 'Failed to create job');
      }

      Alert.alert(
        "Sent!",
        "Your request has been sent to mechanics in your area. You'll receive quotes soon.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Error submitting request:", error);
      Alert.alert("Error", error.message || "Failed to submit request");
    } finally {
      setLoadingSubmit(false);
    }
  }, [userId, hasPaymentMethod, symptomKey, symptomLabel, vehicleId, location, savedLat, savedLng, savedAddress, generateProblemDescription]);

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
          <Text style={{ marginTop: spacing.md, ...text.muted }}>Loading questionsâ€¦</Text>
        </View>
      );
    }

    if (!currentQuestion) {
      // No questions â€” handled by step jump to details, but keep safe fallback
      return (
        <View style={{ padding: spacing.lg }}>
          <Text style={text.h2}>A few quick details</Text>
          <Text style={[text.muted, { marginTop: spacing.sm }]}>
            Weâ€™ll use this to match you with the right mechanic.
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
              placeholder="Type your answerâ€¦"
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
        Add your location and any extra details â€” then weâ€™ll send this to nearby mechanics.
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
        <Text style={{ ...text.muted, lineHeight: 18 }}>{getHumanReadableSummary()}</Text>
      </View>

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>Can the vehicle move?</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        {["Yes", "No", "Not sure"].map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setCanMove(option)}
            style={{
              flex: 1,
              backgroundColor: canMove === option ? colors.accent : colors.surface,
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: canMove === option ? colors.accent : colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{
              ...text.body,
              fontWeight: "700",
              color: canMove === option ? "#fff" : colors.textPrimary
            }}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>Where is the vehicle?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
        {["Driveway", "Street", "Parking lot", "Garage", "Other"].map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setVehicleLocation(option)}
            style={{
              backgroundColor: vehicleLocation === option ? colors.accent : colors.surface,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: vehicleLocation === option ? colors.accent : colors.border,
            }}
          >
            <Text style={{
              ...text.body,
              fontWeight: "700",
              color: vehicleLocation === option ? "#fff" : colors.textPrimary
            }}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>When do you need service?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
        {["ASAP", "Today", "This week", "Flexible"].map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setTimePreference(option)}
            style={{
              backgroundColor: timePreference === option ? colors.accent : colors.surface,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: timePreference === option ? colors.accent : colors.border,
            }}
          >
            <Text style={{
              ...text.body,
              fontWeight: "700",
              color: timePreference === option ? "#fff" : colors.textPrimary
            }}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ ...text.body, fontWeight: "900", marginBottom: spacing.sm }}>Your Location</Text>
      {loadingLocation ? (
        <View
          style={{
            backgroundColor: colors.surface,
            padding: spacing.lg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 50,
          }}
        >
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ ...text.muted, marginTop: spacing.sm }}>Getting your locationâ€¦</Text>
        </View>
      ) : locationError ? (
        <View
          style={{
            backgroundColor: colors.surface,
            padding: spacing.lg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: spacing.sm }} />
            <Text style={{ ...text.body, color: colors.error, flex: 1 }}>
              {locationError}
            </Text>
          </View>
          <TouchableOpacity
            onPress={getCurrentLocation}
            style={{
              backgroundColor: colors.accent,
              padding: spacing.md,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ ...text.body, fontWeight: "700", color: "#000" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.surface,
            padding: spacing.lg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xs }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
              <Text style={{ ...text.body, color: colors.accent, fontWeight: "700" }}>
                Location detected
              </Text>
            </View>
            <Text style={{ ...text.muted }}>{location || "Getting addressâ€¦"}</Text>
          </View>
          <TouchableOpacity
            onPress={getCurrentLocation}
            style={{ marginLeft: spacing.md }}
          >
            <Ionicons name="refresh" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

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


