import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  BackHandler,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../src/lib/supabase";
import { isValidUUID } from "../../src/lib/validation";
import { useTheme } from "../../src/ui/theme-context";
import { createCard, cardPressed } from "../../src/ui/styles";
import { VehicleChip } from "../../src/components/VehicleChip";
import { VehiclePickerDrawer } from "../../src/components/VehiclePickerDrawer";
import { useFocusEffect } from "@react-navigation/native";
import { normalize } from "../../src/ui/theme";
import QuestionRenderer from "../../src/components/QuestionRenderer";

type Step =
  | "education"
  | "questions"
  | "context"
  | "safety_measures"
  | "review"
  | "searching";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type SymptomRow = {
  key: string;
  label: string;
  icon: string;
};

type SymptomMappingRow = {
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  customer_explainer: string | null;
  quote_strategy: string | null;
};

type SymptomEducationRow = {
  symptom_key: string;
  title: string;
  summary: string;
  is_it_safe: string;
  what_we_check: string;
  how_quotes_work: string;
};

type EducationCardRow = {
  symptom_key: string;
  card_key: string;
  title: string | null;
  summary: string | null;
  what_we_check: string | null;
  is_it_safe: string | null;
  quote_expectation: string | null;
  order_index: number | null;
};

type SymptomQuestionRow = {
  id: string;
  symptom_key: string;
  question_key: string;
  question_text: string;
  question_type: string;
  options: any; // jsonb
  affects_safety: boolean;
  affects_quote: boolean;
  affects_tools: boolean;
  display_order: number;
};

type UiSymptomData = {
  key: string;
  label: string;
  icon: string;
  education: {
    title: string;
    summary: string;
    is_it_safe: string;
    what_we_check: string;
    how_quotes_work: string;
  };
};

type UiQuestion = {
  id: string;
  symptom_key: string;
  question_key: string;
  question_label: string;
  question_type: string;
  options: string[];
  affects_safety?: boolean;
  affects_quote?: boolean;
  affects_tools?: boolean;
};

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function safeDecode(param?: string) {
  if (!param) return undefined;
  try {
    return decodeURIComponent(param).trim();
  } catch {
    return param.trim();
  }
}

function coerceOptions(options: any): string[] {
  // supports jsonb being:
  // - ["A","B"]
  // - { options: ["A","B"] }
  // - [{label:"A"}, {label:"B"}]
  if (!options) return [];
  if (Array.isArray(options)) {
    if (options.every((x) => typeof x === "string")) return options;
    if (options.every((x) => typeof x?.label === "string")) return options.map((x) => x.label);
  }
  if (Array.isArray(options?.options)) {
    if (options.options.every((x: any) => typeof x === "string")) return options.options;
    if (options.options.every((x: any) => typeof x?.label === "string")) return options.options.map((x: any) => x.label);
  }
  return [];
}

export default function RequestService() {
  const params = useLocalSearchParams<{
    symptom?: string | string[];
    vehicleId?: string | string[];
    vehicleYear?: string | string[];
    vehicleMake?: string | string[];
    vehicleModel?: string | string[];
    vehicleNickname?: string | string[];
  }>();

  const { colors, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const textStyles = useMemo(
    () => ({
      title: { fontSize: normalize(24), fontWeight: "900" as const, color: colors.textPrimary },
      section: { fontSize: normalize(16), fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: normalize(14), fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: normalize(13), fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  // -----------------------
  // flow state
  // -----------------------
  const [step, setStep] = useState<Step>("education");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [canMove, setCanMove] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [mileage, setMileage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [safetyChecks, setSafetyChecks] = useState({
    vehicleConfirmed: false,
    locationAccurate: false,
    availableForContact: false,
    understandsProcess: false,
  });

  // -----------------------
  // symptom bundle (db)
  // -----------------------
  const rawSymptom = safeDecode(normalizeParam(params.symptom));
  const symptomKey = rawSymptom || "not_sure";

  const [symptom, setSymptom] = useState<SymptomRow | null>(null);
  const [mapping, setMapping] = useState<SymptomMappingRow | null>(null);
  const [education, setEducation] = useState<SymptomEducationRow | null>(null);
  const [eduCardFallback, setEduCardFallback] = useState<EducationCardRow | null>(null);
  const [questions, setQuestions] = useState<UiQuestion[]>([]);
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const symptomData: UiSymptomData | null = useMemo(() => {
    if (!symptom) return null;

    // prefer symptom_education, else fallback to education_cards
    const edu =
      education ||
      (eduCardFallback
        ? ({
            symptom_key: eduCardFallback.symptom_key,
            title: eduCardFallback.title ?? symptom.label,
            summary: eduCardFallback.summary ?? mapping?.customer_explainer ?? "",
            is_it_safe: eduCardFallback.is_it_safe ?? "We’ll assess safety during diagnosis.",
            what_we_check: eduCardFallback.what_we_check ?? "",
            how_quotes_work: eduCardFallback.quote_expectation ?? "Mechanics will send quotes. No payment until you accept.",
          } as SymptomEducationRow)
        : null);

    return {
      key: symptom.key,
      label: symptom.label,
      icon: symptom.icon,
      education: {
        title: edu?.title ?? symptom.label,
        summary: edu?.summary ?? mapping?.customer_explainer ?? "",
        is_it_safe: edu?.is_it_safe ?? "",
        what_we_check: edu?.what_we_check ?? "",
        how_quotes_work: edu?.how_quotes_work ?? "",
      },
    };
  }, [symptom, mapping, education, eduCardFallback]);

const loadSymptomBundle = useCallback(async () => {
  try {
    setLoadingBundle(true);
    setBundleError(null);

    // 1) mapping is canonical
    const { data: map, error: mapErr } = await supabase
      .from("symptom_mappings")
      .select("symptom_key,symptom_label,category,risk_level,customer_explainer,quote_strategy")
      .eq("symptom_key", symptomKey)
      .single();

    let effectiveKey = symptomKey;
    let mappingRow: SymptomMappingRow | null = null;

    if (mapErr || !map) {
      const { data: fbMap, error: fbErr } = await supabase
        .from("symptom_mappings")
        .select("symptom_key,symptom_label,category,risk_level,customer_explainer,quote_strategy")
        .eq("symptom_key", "not_sure")
        .single();

      if (fbErr || !fbMap) throw new Error("Symptom not found.");
      effectiveKey = "not_sure";
      mappingRow = fbMap as SymptomMappingRow;
    } else {
      mappingRow = map as SymptomMappingRow;
    }

    setMapping(mappingRow);

    // 1b) icon row (optional)
    const { data: sym } = await supabase
      .from("symptoms")
      .select("key,label,icon")
      .eq("key", effectiveKey)
      .single();

    setSymptom(
      sym
        ? (sym as SymptomRow)
        : ({
            key: effectiveKey,
            label: mappingRow.symptom_label,
            icon: "❓",
          } as SymptomRow)
    );

    // 2) education
    const { data: edu } = await supabase
      .from("symptom_education")
      .select("symptom_key,title,summary,is_it_safe,what_we_check,how_quotes_work")
      .eq("symptom_key", effectiveKey)
      .single();

    setEducation((edu as SymptomEducationRow) ?? null);

    // 3) questions  ✅ MUST BE INSIDE THIS ASYNC FUNCTION
    const { data: qRows, error: qErr } = await supabase
      .from("symptom_questions")
      .select("id,symptom_key,question_key,question_text,question_type,options,affects_safety,affects_quote,affects_tools,display_order")
      .eq("symptom_key", effectiveKey)
      .order("display_order", { ascending: true });

    if (qErr) throw qErr;

    setQuestions(
      (qRows ?? []).map((q: any) => ({
        id: q.id,
        symptom_key: q.symptom_key,
        question_key: q.question_key,
        question_label: q.question_text,
        question_type: q.question_type,
        options: coerceOptions(q.options),
        affects_safety: q.affects_safety,
        affects_quote: q.affects_quote,
        affects_tools: q.affects_tools,
      }))
    );

    // reset flow
    setStep("education");
    setCurrentQuestionIndex(0);
    setAnswers({});
  } catch (e: any) {
    console.error("❌ loadSymptomBundle failed:", e);
    setBundleError(e?.message ?? "Failed to load symptom data.");
  } finally {
    setLoadingBundle(false);
  }
}, [symptomKey]);



     

  useEffect(() => {
    loadSymptomBundle();
  }, [loadSymptomBundle]);

  // if we land on questions but none exist, skip
  useEffect(() => {
    if (step === "questions" && questions.length === 0) setStep("context");
  }, [step, questions.length]);

  // -----------------------
  // vehicles
  // -----------------------
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleLoadError, setVehicleLoadError] = useState<string | null>(null);
  const [verifyingVehicle, setVerifyingVehicle] = useState(false);

  const vehicleIdParam = normalizeParam(params.vehicleId);
  const vehicleYearParam = normalizeParam(params.vehicleYear);
  const vehicleMakeParam = normalizeParam(params.vehicleMake);
  const vehicleModelParam = normalizeParam(params.vehicleModel);
  const vehicleNicknameParam = normalizeParam(params.vehicleNickname);

  const hasVehicleParams =
    vehicleIdParam &&
    vehicleYearParam &&
    vehicleMakeParam &&
    vehicleModelParam &&
    isValidUUID(vehicleIdParam);

  const loadVehicles = useCallback(async () => {
    try {
      setLoadingVehicles(true);
      setVehicleLoadError(null);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw new Error("Authentication failed. Please log in again.");

      const userId = userData.user?.id;
      if (!userId) throw new Error("User session not found. Please log in again.");

      const { data, error } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setVehicles((data as Vehicle[]) ?? []);
    } catch (e: any) {
      console.error("Failed to load vehicles:", e);
      setVehicleLoadError(e.message || "Unable to load vehicles. Please try again.");
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    if (step === "review") loadVehicles();
  }, [step, loadVehicles]);

  useFocusEffect(
    useCallback(() => {
      if (step === "review") loadVehicles();
    }, [step, loadVehicles])
  );

  useEffect(() => {
    if (step === "review" && vehicles.length === 1 && !selectedVehicleId) {
      const v = vehicles[0];
      setSelectedVehicleId(v.id);
      setSelectedVehicle(v);
    }
  }, [vehicles, step, selectedVehicleId]);

  useEffect(() => {
    if (step === "review" && !verifyingVehicle && !loadingVehicles && !selectedVehicleId && vehicles.length !== 1) {
      setShowVehicleDrawer(true);
    }
  }, [step, verifyingVehicle, loadingVehicles, selectedVehicleId, vehicles.length]);

  // verify vehicle from params (ownership check best-effort; submit re-checks)
  useEffect(() => {
    const verifyVehicleFromParams = async () => {
      if (!hasVehicleParams || !vehicleIdParam) return;

      setVerifyingVehicle(true);

      // optimistic set
      setSelectedVehicleId(vehicleIdParam);
      setSelectedVehicle({
        id: vehicleIdParam,
        year: parseInt(vehicleYearParam!, 10),
        make: vehicleMakeParam!,
        model: vehicleModelParam!,
        nickname: vehicleNicknameParam || null,
      });

      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        const { data: v, error } = await supabase
          .from("vehicles")
          .select("id,customer_id")
          .eq("id", vehicleIdParam)
          .single();

        if (error || !v) {
          Alert.alert("Vehicle Not Found", "The vehicle from the link no longer exists. Please select another vehicle.", [
            { text: "OK", onPress: () => setShowVehicleDrawer(true) },
          ]);
          setSelectedVehicleId(null);
          setSelectedVehicle(null);
          return;
        }

        if (v.customer_id !== userId) {
          Alert.alert("Invalid Vehicle", "This vehicle does not belong to your account. Please select your own vehicle.", [
            { text: "OK", onPress: () => setShowVehicleDrawer(true) },
          ]);
          setSelectedVehicleId(null);
          setSelectedVehicle(null);
          return;
        }
      } catch (e) {
        console.error("verifyVehicleFromParams failed:", e);
      } finally {
        setVerifyingVehicle(false);
      }
    };

    verifyVehicleFromParams();
  }, [hasVehicleParams, vehicleIdParam, vehicleYearParam, vehicleMakeParam, vehicleModelParam, vehicleNicknameParam]);

  const handleChangeVehicle = () => setShowVehicleDrawer(true);
  const handleSelectVehicleFromDrawer = (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    setSelectedVehicle(v);
    setShowVehicleDrawer(false);
  };
  const handleAddNewVehicle = () => setShowVehicleDrawer(false);

  // -----------------------
  // back handling
  // -----------------------
  const handleBack = useCallback(() => {
    if (step === "education") {
      router.back();
      return true;
    }
    if (step === "questions") {
      if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1);
      else setStep("education");
      return true;
    }
    if (step === "context") {
      if (questions.length > 0) {
        setStep("questions");
        setCurrentQuestionIndex(Math.max(0, questions.length - 1));
      } else setStep("education");
      return true;
    }
    if (step === "safety_measures") {
      setStep("context");
      return true;
    }
    if (step === "review") {
      setStep("safety_measures");
      return true;
    }
    if (step === "searching") return true;
    return false;
  }, [step, currentQuestionIndex, questions.length]);

  useEffect(() => {
    const bh = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => bh.remove();
  }, [handleBack]);

  // -----------------------
  // flow actions
  // -----------------------
  const handleContinueFromEducation = () => {
    if (questions.length > 0) {
      setCurrentQuestionIndex(0);
      setStep("questions");
    } else {
      setStep("context");
    }
  };

  const handleAnswerQuestion = (answer: string | string[]) => {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    setAnswers((prev) => ({ ...prev, [q.question_key]: answer }));

    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex((i) => i + 1);
    else setStep("context");
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!symptomData?.key) {
        Alert.alert("Missing", "Symptom not loaded. Please try again.");
        setStep("education");
        return;
      }

      if (!canMove || !locationType) {
        Alert.alert("Missing Information", "Please provide context about your vehicle and location.");
        setStep("context");
        return;
      }

      const allSafetyChecked = Object.values(safetyChecks).every(Boolean);
      if (!allSafetyChecked) {
        Alert.alert("Safety Checklist", "Please complete all safety checks.");
        setStep("safety_measures");
        return;
      }

      if (!selectedVehicleId || !isValidUUID(selectedVehicleId) || !selectedVehicle) {
        Alert.alert("Vehicle Required", "Please select a valid vehicle before submitting.");
        setShowVehicleDrawer(true);
        setStep("review");
        return;
      }

      // auth check
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

      // ID verification
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id_status")
        .eq("auth_id", userId)
        .single();

      if (profileError) {
        Alert.alert("Error", "Failed to verify your account status. Please try again.");
        setStep("review");
        return;
      }

      if (profileData?.id_status !== "verified") {
        Alert.alert(
          "ID Verification Required",
          "You need to verify your photo ID before requesting a mechanic.",
          [
            { text: "Verify Now", onPress: () => router.push("/(auth)/photo-id") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        setStep("review");
        return;
      }

      // vehicle ownership verify
      const { data: vCheck, error: vErr } = await supabase
        .from("vehicles")
        .select("id,customer_id")
        .eq("id", selectedVehicleId)
        .single();

      if (vErr || !vCheck) {
        Alert.alert("Vehicle Not Found", "The selected vehicle no longer exists. Please select another.", [
          { text: "OK", onPress: () => setShowVehicleDrawer(true) },
        ]);
        setStep("review");
        return;
      }

      if (vCheck.customer_id !== userId) {
        Alert.alert("Invalid Vehicle", "This vehicle does not belong to your account.", [
          { text: "OK", onPress: () => setShowVehicleDrawer(true) },
        ]);
        setStep("review");
        return;
      }

      setStep("searching");

      // location
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Location permission is needed.");
        setStep("review");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const intake = {
        symptom: { key: symptomData.key, label: symptomData.label },
        answers,
        context: { can_move: canMove, location_type: locationType, mileage: mileage || null },
        vehicle: {
          id: selectedVehicle.id,
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          nickname: selectedVehicle.nickname || null,
        },
      };

      // ✅ Jobs schema uses lat/lng columns (not geometry)
      const jobPayload = {
        customer_id: userId,
        title: symptomData.label,
        description: JSON.stringify(intake),
        status: "searching",
        location_lat: pos.coords.latitude,
        location_lng: pos.coords.longitude,
        vehicle_id: selectedVehicleId,
        // optional if you add it later:
        // symptom_id: null,
      };

      const { data: insertedJob, error } = await supabase.from("jobs").insert(jobPayload).select("id, vehicle_id").single();
      if (error) throw error;

      setTimeout(() => {
        Alert.alert("Request sent!", "We're notifying nearby mechanics.");
        router.replace("/(customer)/(tabs)/jobs" as any);
      }, 900);
    } catch (e: any) {
      console.error("❌ Job Creation Failed:", e);
      Alert.alert("Error", e?.message ?? "Failed to create request. Please try again.");
      setStep("review");
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------
  // UI sections
  // -----------------------
  const getHeaderTitle = () => {
    switch (step) {
      case "education":
        return "Understanding the Issue";
      case "questions":
        return "Quick Questions";
      case "context":
        return "Context";
      case "safety_measures":
        return "Safety Checklist";
      case "review":
        return "Review & Submit";
      case "searching":
        return "Finding Mechanics";
      default:
        return "";
    }
  };

  const onHeaderBackPress = () => {
    handleBack();
  };

  // loading / error
  if (loadingBundle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 10, ...textStyles.muted }}>Loading symptom…</Text>
      </View>
    );
  }

  if (bundleError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <Text style={{ ...textStyles.section, textAlign: "center" }}>Couldn’t load symptom data</Text>
        <Text style={{ ...textStyles.muted, textAlign: "center", marginTop: spacing.sm }}>{bundleError}</Text>
        <Pressable
          onPress={loadSymptomBundle}
          style={({ pressed }) => ({
            marginTop: spacing.lg,
            backgroundColor: colors.accent,
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!symptomData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={textStyles.body}>Invalid symptom</Text>
      </View>
    );
  }

  const renderEducation = () => {
    const safeText = (symptomData.education.is_it_safe || "").toLowerCase();
    const safetyColor = safeText.includes("safe")
      ? "#10b981"
      : safeText.includes("don't") || safeText.includes("do not") || safeText.includes("not safe")
      ? "#ef4444"
      : "#f59e0b";

    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.surface }}>
        {selectedVehicle && (
          <VehicleChip
            year={selectedVehicle.year.toString()}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={() => setShowVehicleDrawer(true)}
          />
        )}

        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.sm }}>
          <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 52 }}>{symptomData.icon}</Text>
          </View>
          <Text style={{ ...textStyles.title, textAlign: "center", fontSize: 26 }}>{symptomData.education.title}</Text>
        </View>

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <Text style={{ ...textStyles.body, lineHeight: 22, fontSize: 15 }}>{symptomData.education.summary}</Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {!!symptomData.education.is_it_safe && (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: safetyColor + "15", flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={{ fontSize: 18 }}>🛟</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: safetyColor, flex: 1, lineHeight: 18 }}>
                  {symptomData.education.is_it_safe}
                </Text>
              </View>
            )}

            {!!symptomData.education.what_we_check && (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: colors.accent + "15", flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={{ fontSize: 18 }}>🔍</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accent, flex: 1, lineHeight: 18 }}>
                  {symptomData.education.what_we_check}
                </Text>
              </View>
            )}

            {!!symptomData.education.how_quotes_work && (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: colors.textMuted + "15", flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={{ fontSize: 18 }}>💵</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, flex: 1, lineHeight: 18 }}>
                  {symptomData.education.how_quotes_work}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ padding: spacing.lg, paddingRight: 80, borderRadius: 12, backgroundColor: colors.accent + "08", borderWidth: 1, borderColor: colors.accent + "20", position: "relative" }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted, lineHeight: 20 }}>
            Good news! I’ll ask a couple quick questions to help mechanics give you an accurate quote.
          </Text>
          <Image source={require("../../assets/peaking.png")} style={{ position: "absolute", right: -10, top: "50%", marginTop: -32, width: 64, height: 64 }} resizeMode="contain" />
        </View>

        <Pressable
          onPress={handleContinueFromEducation}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            padding: spacing.lg,
            borderRadius: 14,
            opacity: pressed ? 0.85 : 1,
            elevation: 4,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", textAlign: "center" }}>Continue</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderQuestions = () => {
    if (questions.length === 0) return null;

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    // pass shape QuestionRenderer expects
    const questionForRenderer: any = {
      question_key: currentQuestion.question_key,
      question_label: currentQuestion.question_label,
      question_type: currentQuestion.question_type,
      options: currentQuestion.options,
    };

    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {selectedVehicle && (
          <VehicleChip
            year={selectedVehicle.year.toString()}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={() => setShowVehicleDrawer(true)}
          />
        )}

        <View>
          <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginBottom: spacing.sm }}>
            <View style={{ height: "100%", width: `${progress}%`, backgroundColor: colors.accent }} />
          </View>
          <Text style={textStyles.muted}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
        </View>

        <Text style={{ ...textStyles.title, fontSize: 20 }}>{currentQuestion.question_label}</Text>

        <QuestionRenderer
          question={questionForRenderer}
          value={answers[currentQuestion.question_key]}
          onAnswer={handleAnswerQuestion}
        />
      </ScrollView>
    );
  };

  const renderContext = () => (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text style={textStyles.title}>Context & Safety</Text>

      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>Can the car move?</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {["Yes", "No", "Not sure"].map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setCanMove(opt)}
                style={[
                  card,
                  { flex: 1, padding: spacing.md, backgroundColor: colors.bg, borderWidth: 2, borderColor: canMove === opt ? colors.accent : colors.border },
                ]}
              >
                <Text style={{ ...textStyles.body, textAlign: "center", color: canMove === opt ? colors.accent : colors.textPrimary, fontWeight: canMove === opt ? "900" : "600" }}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>Location type</Text>
          <View style={{ gap: spacing.sm }}>
            {["Driveway", "Parking lot", "Roadside"].map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setLocationType(opt)}
                style={[
                  card,
                  { padding: spacing.md, backgroundColor: colors.bg, borderWidth: 2, borderColor: locationType === opt ? colors.accent : colors.border },
                ]}
              >
                <Text style={{ ...textStyles.body, color: locationType === opt ? colors.accent : colors.textPrimary, fontWeight: locationType === opt ? "900" : "600" }}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>Mileage (optional)</Text>
          <TextInput
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="numeric"
            style={[card, { padding: spacing.md, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.bg }]}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setStep("safety_measures")}
        disabled={!canMove || !locationType}
        style={({ pressed }) => ({
          backgroundColor: !canMove || !locationType ? colors.border : colors.accent,
          padding: spacing.lg,
          borderRadius: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" }}>Continue</Text>
      </Pressable>
    </ScrollView>
  );

  const renderSafetyMeasures = () => {
    const allChecked = Object.values(safetyChecks).every(Boolean);

    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={textStyles.title}>Safety Checklist</Text>

        <View style={{ gap: spacing.md }}>
          {([
            { key: "vehicleConfirmed" as const, title: "I confirm this is the correct vehicle", subtitle: selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : "No vehicle selected" },
            { key: "locationAccurate" as const, title: "My location is accurate", subtitle: "Mechanics will use your location to find you" },
            { key: "availableForContact" as const, title: "I'm available to respond to mechanics", subtitle: "Check your messages for quotes and questions" },
            { key: "understandsProcess" as const, title: "I understand the quote process", subtitle: "No payment until you accept a quote" },
          ] as const).map((item) => {
            const checked = safetyChecks[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() => setSafetyChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                style={[
                  card,
                  { padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.bg, borderWidth: 2, borderColor: checked ? colors.accent : colors.border },
                ]}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: checked ? colors.accent : colors.border, justifyContent: "center", alignItems: "center" }}>
                  {checked && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...textStyles.body, fontWeight: "800" }}>{item.title}</Text>
                  <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>{item.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setStep("review")}
          disabled={!allChecked}
          style={({ pressed }) => ({
            backgroundColor: !allChecked ? colors.border : colors.accent,
            padding: spacing.lg,
            borderRadius: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: !allChecked ? colors.textMuted : "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" }}>
            {allChecked ? "Continue to Review" : "Complete all checks to continue"}
          </Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderReview = () => (
    <>
      <VehiclePickerDrawer
        visible={showVehicleDrawer}
        onClose={() => setShowVehicleDrawer(false)}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelect={(v: Vehicle) => {
          setSelectedVehicleId(v.id);
          setSelectedVehicle(v);
          setShowVehicleDrawer(false);
        }}
        onAddNew={() => setShowVehicleDrawer(false)}
        loading={loadingVehicles}
        returnTo="request-service"
        error={vehicleLoadError}
        onRetry={loadVehicles}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={textStyles.title}>Review & Submit</Text>

        {selectedVehicle ? (
          <Pressable
            onPress={() => setShowVehicleDrawer(true)}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              { padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.accent + "40" },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={textStyles.muted}>Vehicle</Text>
              <Text style={{ ...textStyles.section, marginTop: 4 }}>
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </Text>
              {!!selectedVehicle.nickname && <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>“{selectedVehicle.nickname}”</Text>}
            </View>
            <Text style={{ ...textStyles.section, color: colors.accent }}>Change</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowVehicleDrawer(true)}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              { padding: spacing.lg, backgroundColor: colors.accent + "15", borderWidth: 2, borderColor: colors.accent, borderStyle: "dashed" },
            ]}
          >
            <Text style={{ ...textStyles.body, color: colors.accent, textAlign: "center" }}>🚗 Select Vehicle (Required)</Text>
          </Pressable>
        )}

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <View>
            <Text style={textStyles.muted}>Issue</Text>
            <Text style={{ ...textStyles.section, marginTop: 4 }}>{symptomData.icon} {symptomData.label}</Text>
          </View>

          {Object.keys(answers).length > 0 && (
            <View>
              <Text style={textStyles.muted}>Your answers</Text>
              {Object.entries(answers).map(([qKey, answer]) => {
                const q = questions.find((qq) => qq.question_key === qKey);
                return (
                  <View key={qKey} style={{ marginTop: spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{q?.question_label ?? "Question"}</Text>
                    <Text style={{ ...textStyles.body, marginTop: 2 }}>{Array.isArray(answer) ? answer.join(", ") : answer}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View>
            <Text style={textStyles.muted}>Context</Text>
            <Text style={{ ...textStyles.body, marginTop: 4 }}>
              Can move: {canMove} • Location: {locationType}
              {mileage && ` • ${mileage} miles`}
            </Text>
          </View>

          {!!symptomData.education.how_quotes_work && (
            <View style={{ marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.accent + "10", borderWidth: 1, borderColor: colors.accent }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                {symptomData.education.how_quotes_work}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !selectedVehicleId}
          style={({ pressed }) => ({
            backgroundColor: !selectedVehicleId ? colors.border : colors.accent,
            padding: spacing.lg,
            borderRadius: 14,
            opacity: pressed || submitting ? 0.85 : 1,
          })}
        >
          <Text style={{ color: !selectedVehicleId ? colors.textMuted : "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" }}>
            {submitting ? "Submitting..." : !selectedVehicleId ? "Select Vehicle to Continue" : "🔵 Request Mechanics"}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );

  const renderSearching = () => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, gap: spacing.lg }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ ...textStyles.title, textAlign: "center" }}>Finding Mechanics</Text>
      <Text style={{ ...textStyles.muted, textAlign: "center", lineHeight: 20, maxWidth: 320 }}>
        You're all set! We’re notifying nearby mechanics now. You’ll get quotes soon.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, gap: spacing.md }}>
      <Stack.Screen
        key={`${step}-${colors.bg}-${colors.textPrimary}`}
        options={{
          title: getHeaderTitle(),
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerShadowVisible: false,
          headerLeft:
            step !== "searching"
              ? () => (
                  <Pressable
                    onPress={onHeaderBackPress}
                    style={({ pressed }) => ({ padding: 8, marginLeft: -5, marginRight: 15, opacity: pressed ? 0.5 : 1 })}
                  >
                    <Text style={{ fontSize: 16, color: colors.accent, fontWeight: "900" }}>Back</Text>
                  </Pressable>
                )
              : undefined,
          gestureEnabled: step !== "searching",
        }}
      />

      {step === "education" && renderEducation()}
      {step === "questions" && renderQuestions()}
      {step === "context" && renderContext()}
      {step === "safety_measures" && renderSafetyMeasures()}
      {step === "review" && renderReview()}
      {step === "searching" && renderSearching()}
    </View>
  );
}
