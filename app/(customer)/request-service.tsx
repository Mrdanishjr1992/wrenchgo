import { useState, useMemo, useCallback, useEffect } from "react";
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
import React from "react";
import QuestionRenderer from "../../src/components/QuestionRenderer";
import { symptomQuestions } from "../../src/data/symptomQuestions";
import { symptomDatabase } from "../../src/data/symptomDatabase";

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
  const card = createCard(colors);

  const normalizeParam = (
    param: string | string[] | undefined
  ): string | undefined => {
    if (!param) return undefined;
    if (Array.isArray(param)) return param[0];
    return param;
  };

  const textStyles = useMemo(
    () => ({
      title: {
        fontSize: normalize(24),
        fontWeight: "900" as const,
        color: colors.textPrimary,
      },
      section: {
        fontSize: normalize(16),
        fontWeight: "800" as const,
        color: colors.textPrimary,
      },
      body: {
        fontSize: normalize(14),
        fontWeight: "600" as const,
        color: colors.textPrimary,
      },
      muted: {
        fontSize: normalize(13),
        fontWeight: "600" as const,
        color: colors.textMuted,
      },
    }),
    [colors]
  );

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

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null
  );
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleLoadError, setVehicleLoadError] = useState<string | null>(null);

  const symptomKey = normalizeParam(params.symptom) || "not_sure";
  const symptomData = symptomDatabase[symptomKey];
  const questions = symptomQuestions[symptomKey] || [];

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

  console.log("🚗 RequestService: Params received", {
    symptom: symptomKey,
    vehicleIdParam,
    vehicleYearParam,
    vehicleMakeParam,
    vehicleModelParam,
    hasVehicleParams,
    isValidUUID: vehicleIdParam ? isValidUUID(vehicleIdParam) : false,
  });

  // ✅ If we land on "questions" but there are no questions, move to context (no setState inside render)
  useEffect(() => {
    if (step === "questions" && questions.length === 0) {
      setStep("context");
    }
  }, [step, questions.length]);

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

      if (error) throw new Error("Failed to load vehicles from database. Please try again.");

      setVehicles((data as Vehicle[]) ?? []);
    } catch (e: any) {
      console.error("Failed to load vehicles:", e);
      setVehicleLoadError(
        e.message ||
          "Unable to load vehicles. Please check your connection and try again."
      );
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    const verifyVehicleFromParams = async () => {
      if (hasVehicleParams && vehicleIdParam && isValidUUID(vehicleIdParam)) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;

          if (!userId) {
            console.warn("⚠️ No user session found for vehicle verification");
            return;
          }

          const { data: vehicleCheck, error } = await supabase
            .from("vehicles")
            .select("id, customer_id")
            .eq("id", vehicleIdParam)
            .single();

          if (error || !vehicleCheck) {
            console.warn("⚠️ Vehicle from deep link not found:", vehicleIdParam);
            Alert.alert(
              "Vehicle Not Found",
              "The vehicle from the link no longer exists. Please select another vehicle.",
              [{ text: "OK" }]
            );
            return;
          }

          if (vehicleCheck.customer_id !== userId) {
            console.warn("⚠️ Vehicle from deep link belongs to different user");
            Alert.alert(
              "Invalid Vehicle",
              "This vehicle does not belong to your account. Please select your own vehicle.",
              [{ text: "OK" }]
            );
            return;
          }

          setSelectedVehicleId(vehicleIdParam);
          setSelectedVehicle({
            id: vehicleIdParam,
            year: parseInt(vehicleYearParam!, 10),
            make: vehicleMakeParam!,
            model: vehicleModelParam!,
            nickname: vehicleNicknameParam || null,
          });
        } catch (e) {
          console.error("❌ Failed to verify vehicle from params:", e);
        }
      }
    };

    verifyVehicleFromParams();
  }, [
    hasVehicleParams,
    vehicleIdParam,
    vehicleYearParam,
    vehicleMakeParam,
    vehicleModelParam,
    vehicleNicknameParam,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (step === "review") {
        loadVehicles();
      }
    }, [step, loadVehicles])
  );

  useEffect(() => {
    if (step === "review" && vehicles.length === 1 && !selectedVehicleId) {
      const vehicle = vehicles[0];
      setSelectedVehicleId(vehicle.id);
      setSelectedVehicle(vehicle);
    }
  }, [vehicles, step, selectedVehicleId]);

useEffect(() => {
  if (step === "review" && !loadingVehicles && !selectedVehicleId && vehicles.length !== 1) {
    setShowVehicleDrawer(true);
  }
}, [step, loadingVehicles, selectedVehicleId, vehicles.length]);


  const handleChangeVehicle = () => setShowVehicleDrawer(true);

  const handleSelectVehicleFromDrawer = (vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicle(vehicle);
    setShowVehicleDrawer(false);
  };

  const handleAddNewVehicle = () => {
    setShowVehicleDrawer(false);
  };

  const handleBack = useCallback(() => {
    if (step === "education") {
      router.back();
      return true;
    }

    if (step === "questions") {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex((i) => i - 1);
      } else {
        setStep("education");
      }
      return true;
    }

    if (step === "context") {
      if (questions.length > 0) {
        setStep("questions");
        setCurrentQuestionIndex(questions.length - 1);
      } else {
        setStep("education");
      }
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

    if (step === "searching") {
      return true; // block back while searching/submitting
    }

    return false;
  }, [step, currentQuestionIndex, questions.length]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack
    );
    return () => backHandler.remove();
  }, [handleBack]);

  if (!symptomData) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <Text style={textStyles.body}>Invalid symptom</Text>
      </View>
    );
  }

  const handleContinueFromEducation = () => {
    if (questions.length > 0) {
      setCurrentQuestionIndex(0);
      setStep("questions");
    } else {
      setStep("context");
    }
  };

  const handleAnswerQuestion = (answer: string | string[]) => {
    const currentQuestion = questions[currentQuestionIndex];

    setAnswers((prev) => ({ ...prev, [currentQuestion.question_key]: answer }));

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      setStep("context");
    }
  };

const handleSubmit = async () => {
  try {
    setSubmitting(true);

    // ----- Basic validation -----
    if (!symptomData || !symptomData.label) {
      Alert.alert("Missing Information", "Please select a symptom to continue.");
      setStep("education");
      return;
    }

    if (!canMove || !locationType) {
      Alert.alert(
        "Missing Information",
        "Please provide context about your vehicle's condition and location."
      );
      setStep("context");
      return;
    }

    const allSafetyChecked = Object.values(safetyChecks).every((v) => v === true);
    if (!allSafetyChecked) {
      Alert.alert("Safety Checklist", "Please complete all safety checks before submitting.");
      setStep("safety_measures");
      return;
    }

    if (!selectedVehicleId || !isValidUUID(selectedVehicleId) || !selectedVehicle) {
      Alert.alert("Vehicle Required", "Please select a valid vehicle before submitting your request.");
      setShowVehicleDrawer(true);
      setStep("review");
      return;
    }

    // ----- Auth check -----
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      Alert.alert("Not signed in", "Please sign in again.");
      router.replace("/(auth)/sign-in");
      return;
    }

    // ----- ID verification check -----
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
        "You need to verify your photo ID before requesting a mechanic. This helps ensure safety and trust for all users.",
        [
          {
            text: "Verify Now",
            onPress: () => {
              setStep("review"); // ✅ prevents being stuck
              router.push("/(auth)/photo-id");
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setStep("review"), // ✅ prevents being stuck
          },
        ]
      );
      return;
    }

    // ----- Ownership verification -----
    const { data: vehicleCheck, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, customer_id")
      .eq("id", selectedVehicleId)
      .single();

    if (vehicleError || !vehicleCheck) {
      Alert.alert(
        "Vehicle Not Found",
        "The selected vehicle no longer exists. Please select another vehicle.",
        [{ text: "OK", onPress: () => setShowVehicleDrawer(true) }]
      );
      setStep("review");
      return;
    }

    if (vehicleCheck.customer_id !== userId) {
      Alert.alert(
        "Invalid Vehicle",
        "This vehicle does not belong to your account. Please select a valid vehicle.",
        [{ text: "OK", onPress: () => setShowVehicleDrawer(true) }]
      );
      setStep("review");
      return;
    }

    // ✅ NOW we can show searching (after all early-returns are done)
    setStep("searching");

    // ----- Location permission + get coords -----
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Location permission is needed.");
      setStep("review");
      return;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // ✅ Safer WKT (commonly required for geometry/geography Point columns)
    const wkt = `SRID=4326;POINT(${pos.coords.longitude} ${pos.coords.latitude})`;

    const intake = {
      symptom: { key: symptomKey, label: symptomData.label },
      answers,
      context: {
        can_move: canMove,
        location_type: locationType,
        mileage: mileage || null,
      },
      vehicle: {
        id: selectedVehicle.id,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        nickname: selectedVehicle.nickname || null,
      },
    };

    const jobPayload = {
      customer_id: userId,
      title: symptomData.label,
      description: JSON.stringify(intake),
      status: "searching",
      location: wkt,
      vehicle_id: selectedVehicleId,
    };

    const { data: insertedJob, error } = await supabase
      .from("jobs")
      .insert(jobPayload)
      .select("id, vehicle_id")
      .single();

    if (error) throw error;

    if (selectedVehicleId && !insertedJob.vehicle_id) {
      Alert.alert(
        "Warning",
        "Job created but vehicle information may not have been saved. Please contact support if needed.",
        [{ text: "OK", onPress: () => router.replace("/(customer)/(tabs)/index" as any) }]
      );
      return;
    }

    setTimeout(() => {
      Alert.alert("Request sent!", "We're notifying nearby mechanics.");
      router.replace("/(customer)/(tabs)/jobs" as any);
    }, 1200);
  } catch (e: any) {
    console.error("❌ Job Creation Failed:", e);
    Alert.alert("Error", e?.message ?? "Failed to create request. Please try again.");
    setStep("review");
  } finally {
    setSubmitting(false);
  }
};


  const renderEducation = () => {
    const safeText = (symptomData.education.is_it_safe || "").toLowerCase();
    const safetyColor = safeText.includes("safe")
      ? "#10b981"
      : safeText.includes("don't") || safeText.includes("do not")
      ? "#ef4444"
      : "#f59e0b";

    return (
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          backgroundColor: colors.surface,
        }}
      >
        {hasVehicleParams && selectedVehicle && (
          <VehicleChip
            year={selectedVehicle.year.toString()}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={handleChangeVehicle}
          />
        )}

        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.sm }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 52 }}>{symptomData.icon}</Text>
          </View>
          <Text style={{ ...textStyles.title, textAlign: "center", fontSize: 26 }}>
            {symptomData.education.title}
          </Text>
        </View>

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <Text style={{ ...textStyles.body, lineHeight: 22, fontSize: 15 }}>
            {symptomData.education.summary}
          </Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 10,
                backgroundColor: safetyColor + "15",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 18 }}>🛟</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: safetyColor,
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {symptomData.education.is_it_safe}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 10,
                backgroundColor: colors.accent + "15",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 18 }}>🔍</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.accent,
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {symptomData.education.what_we_check}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 10,
                backgroundColor: colors.textMuted + "15",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 18 }}>💵</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.textMuted,
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {symptomData.education.how_quotes_work}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "20",
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            Good news! This is super common. I&apos;ll ask a couple quick questions to help mechanics give you an accurate quote right away.
          </Text>
          <Image
            source={require("../../assets/peaking.png")}
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              marginTop: -32,
              width: 64,
              height: 64,
            }}
            resizeMode="contain"
          />
        </View>

        <Pressable
          onPress={handleContinueFromEducation}
          style={({ pressed }) => [
            {
              backgroundColor: colors.accent,
              padding: spacing.lg,
              borderRadius: 14,
              opacity: pressed ? 0.85 : 1,
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}
        >
          <Text
            style={{
              color: textStyles.section.color,
              fontSize: 17,
              fontWeight: "900",
              textAlign: "center",
              letterSpacing: 0.3,
            }}
          >
            Continue
          </Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderQuestions = () => {
    if (questions.length === 0) return null;

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        {hasVehicleParams && selectedVehicle && (
          <VehicleChip
            year={selectedVehicle.year.toString()}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={handleChangeVehicle}
          />
        )}

        <View>
          <View
            style={{
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              overflow: "hidden",
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${progress}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Text style={textStyles.muted}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
        </View>

        <Text style={{ ...textStyles.title, fontSize: 20 }}>
          {currentQuestion.question_label}
        </Text>

        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "20",
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            {currentQuestionIndex === 0
              ? "Just pick what sounds right - there's no wrong answer! This helps mechanics know exactly what to bring."
              : "Almost there! These details help mechanics give you a more accurate quote upfront."}
          </Text>
          <Image
            source={require("../../assets/peaking.png")}
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              marginTop: -32,
              width: 64,
              height: 64,
            }}
            resizeMode="contain"
          />
        </View>

        {currentQuestion.helps_mechanic_with && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.accent + "10",
              borderWidth: 1,
              borderColor: colors.accent + "30",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.accent }}>
              💡 {currentQuestion.helps_mechanic_with}
            </Text>
          </View>
        )}

        <QuestionRenderer
          question={currentQuestion}
          value={answers[currentQuestion.question_key]}
          onAnswer={handleAnswerQuestion}
        />
      </ScrollView>
    );
  };

  const renderContext = () => (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      {hasVehicleParams && selectedVehicle && (
        <VehicleChip
          year={selectedVehicle.year.toString()}
          make={selectedVehicle.make}
          model={selectedVehicle.model}
          nickname={selectedVehicle.nickname || undefined}
          onPress={handleChangeVehicle}
        />
      )}

      <View
        style={{
          padding: spacing.lg,
          paddingRight: 80,
          borderRadius: 12,
          backgroundColor: colors.accent + "08",
          borderWidth: 1,
          borderColor: colors.accent + "20",
          position: "relative",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.textPrimary,
            lineHeight: 20,
          }}
        >
          Last step! This helps mechanics know what tools to bring and whether they need a tow truck. You&apos;re doing great!
        </Text>
        <Image
          source={require("../../assets/peaking.png")}
          style={{
            position: "absolute",
            right: -10,
            top: "50%",
            marginTop: -32,
            width: 64,
            height: 64,
          }}
          resizeMode="contain"
        />
      </View>

      <Text style={textStyles.title}>Context & Safety</Text>

      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>
            Can the car move?
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {["Yes", "No", "Not sure"].map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setCanMove(opt)}
                style={[
                  card,
                  {
                    flex: 1,
                    padding: spacing.md,
                    backgroundColor: colors.bg,
                    borderWidth: 2,
                    borderColor: canMove === opt ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    ...textStyles.body,
                    textAlign: "center",
                    color: canMove === opt ? colors.accent : colors.textPrimary,
                    fontWeight: canMove === opt ? "900" : "600",
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>
            Location type
          </Text>
          <View style={{ gap: spacing.sm }}>
            {["Driveway", "Parking lot", "Roadside"].map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setLocationType(opt)}
                style={[
                  card,
                  {
                    padding: spacing.md,
                    backgroundColor: colors.bg,
                    borderWidth: 2,
                    borderColor: locationType === opt ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    ...textStyles.body,
                    color: locationType === opt ? colors.accent : colors.textPrimary,
                    fontWeight: locationType === opt ? "900" : "600",
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...textStyles.section, marginBottom: spacing.sm }}>
            Mileage (optional)
          </Text>
          <TextInput
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 45000"
            keyboardType="numeric"
            style={[
              card,
              {
                padding: spacing.md,
                fontSize: 16,
                color: colors.textPrimary,
              },
            ]}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setStep("safety_measures")}
        disabled={!canMove || !locationType}
        style={({ pressed }) => [
          {
            backgroundColor: !canMove || !locationType ? colors.border : colors.accent,
            padding: spacing.lg,
            borderRadius: 14,
            opacity: pressed ? 0.85 : 1,
            shadowColor: !canMove || !locationType ? "transparent" : colors.surface,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: !canMove || !locationType ? 0 : 4,
          },
        ]}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "900",
            textAlign: "center",
            letterSpacing: 0.3,
          }}
        >
          Continue
        </Text>
      </Pressable>
    </ScrollView>
  );

  const renderSafetyMeasures = () => {
    const allChecked = Object.values(safetyChecks).every((v) => v === true);

    return (
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          backgroundColor: colors.bg,
        }}
      >
        {hasVehicleParams && selectedVehicle && (
          <VehicleChip
            year={selectedVehicle.year.toString()}
            make={selectedVehicle.make}
            model={selectedVehicle.model}
            nickname={selectedVehicle.nickname || undefined}
            onPress={handleChangeVehicle}
          />
        )}

        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent,
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            Before we connect you with mechanics, let&apos;s make sure everything is ready. This helps ensure a smooth experience for everyone!
          </Text>
          <Image
            source={require("../../assets/peaking.png")}
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              marginTop: -32,
              width: 64,
              height: 64,
            }}
            resizeMode="contain"
          />
        </View>

        <Text style={textStyles.title}>Safety Checklist</Text>

        <View style={[card, { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface }]}>
          <Text style={{ ...textStyles.section, marginBottom: spacing.xs }}>Quick Summary</Text>
          <View style={{ gap: 4 }}>
            <Text style={textStyles.muted}>
              🚗 Vehicle:{" "}
              {selectedVehicle
                ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                : "Not selected"}
            </Text>
            <Text style={textStyles.muted}>📍 Location: {locationType || "Not set"}</Text>
            <Text style={textStyles.muted}>🔧 Issue: {symptomData.label}</Text>
            <Text style={textStyles.muted}>🚙 Can move: {canMove || "Not set"}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {[
            {
              key: "vehicleConfirmed" as const,
              title: "I confirm this is the correct vehicle",
              subtitle: selectedVehicle
                ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                : "No vehicle selected",
            },
            {
              key: "locationAccurate" as const,
              title: "My location is accurate",
              subtitle: "Mechanics will use your location to find you",
            },
            {
              key: "availableForContact" as const,
              title: "I&apos;m available to respond to mechanics",
              subtitle: "Check your messages for quotes and questions",
            },
            {
              key: "understandsProcess" as const,
              title: "I understand the quote process",
              subtitle: "No payment until you accept a quote",
            },
          ].map((item) => {
            const checked = safetyChecks[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() =>
                  setSafetyChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                style={[
                  card,
                  {
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    backgroundColor: colors.bg,
                    borderWidth: 2,
                    borderColor: checked ? colors.accent : colors.border,
                  },
                ]}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: checked ? colors.accent : colors.border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {checked && (
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
                      ✓
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...textStyles.body, fontWeight: "800" }}>
                    {item.title as any}
                  </Text>
                  <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: colors.accent + "10",
            borderWidth: 1,
            borderColor: colors.accent + "30",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            💡 Mechanics typically respond within 1-2 hours
          </Text>
        </View>

        <Pressable
          onPress={() => setStep("review")}
          disabled={!allChecked}
          style={({ pressed }) => [
            {
              backgroundColor: !allChecked ? colors.border : colors.accent,
              padding: spacing.lg,
              borderRadius: 14,
              opacity: pressed ? 0.85 : 1,
              shadowColor: !allChecked ? "transparent" : colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: !allChecked ? 0 : 4,
            },
          ]}
        >
          <Text
            style={{
              color: !allChecked ? colors.textMuted : "#fff",
              fontSize: 16,
              fontWeight: "900",
              textAlign: "center",
              letterSpacing: 0.3,
            }}
          >
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
        onSelect={handleSelectVehicleFromDrawer}
        onAddNew={handleAddNewVehicle}
        loading={loadingVehicles}
        returnTo="request-service"
        error={vehicleLoadError}
        onRetry={loadVehicles}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            padding: spacing.lg,
            paddingRight: 80,
            borderRadius: 12,
            backgroundColor: colors.accent + "08",
            borderWidth: 1,
            borderColor: colors.accent + "20",
            position: "relative",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              lineHeight: 20,
            }}
          >
            Perfect! Here&apos;s everything you told me. Mechanics will review this and send you quotes—usually within an hour or two. No payment needed until you accept a quote!
          </Text>
          <Image
            source={require("../../assets/peaking.png")}
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              marginTop: -32,
              width: 64,
              height: 64,
            }}
            resizeMode="contain"
          />
        </View>

        <Text style={textStyles.title}>Review & Submit</Text>

        {selectedVehicle ? (
          <Pressable
            onPress={() => setShowVehicleDrawer(true)}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: colors.accent + "40",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={textStyles.muted}>Vehicle</Text>
              <Text style={{ ...textStyles.section, marginTop: 4 }}>
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </Text>
              {selectedVehicle.nickname && (
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  &ldquo;{selectedVehicle.nickname}&rdquo;
                </Text>
              )}
            </View>
            <Text style={{ ...textStyles.section, color: colors.accent }}>Change</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowVehicleDrawer(true)}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                padding: spacing.lg,
                backgroundColor: colors.accent + "15",
                borderWidth: 2,
                borderColor: colors.accent,
                borderStyle: "dashed",
              },
            ]}
          >
            <Text style={{ ...textStyles.body, color: colors.accent, textAlign: "center" }}>
              🚗 Select Vehicle (Required)
            </Text>
          </Pressable>
        )}

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <View>
            <Text style={textStyles.muted}>Issue</Text>
            <Text style={{ ...textStyles.section, marginTop: 4 }}>
              {symptomData.icon} {symptomData.label}
            </Text>
          </View>

          {Object.keys(answers).length > 0 && (
            <View>
              <Text style={textStyles.muted}>Your answers</Text>
              {Object.entries(answers).map(([qKey, answer]) => {
                const q = questions.find((qq) => qq.question_key === qKey);
                return (
                  <View key={qKey} style={{ marginTop: spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {q?.question_label ?? "Question"}
                    </Text>
                    <Text style={{ ...textStyles.body, marginTop: 2 }}>
                      {Array.isArray(answer) ? answer.join(", ") : answer}
                    </Text>
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

          <View
            style={{
              marginTop: spacing.sm,
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.accent + "10",
              borderWidth: 1,
              borderColor: colors.accent,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
              {symptomData.education.how_quotes_work}
            </Text>
          </View>
        </View>

        {!selectedVehicleId && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.accent + "15",
              borderWidth: 1,
              borderColor: colors.accent + "40",
            }}
          >
            <Text style={{ ...textStyles.body, color: colors.accent, textAlign: "center" }}>
              ⚠️ Please select a vehicle before sending the quote
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !selectedVehicleId}
          style={({ pressed }) => [
            {
              backgroundColor: !selectedVehicleId ? colors.border : colors.accent,
              padding: spacing.lg,
              borderRadius: 14,
              opacity: pressed || submitting ? 0.85 : 1,
              shadowColor: !selectedVehicleId ? "transparent" : colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: !selectedVehicleId ? 0 : 4,
            },
          ]}
        >
          <Text
            style={{
              color: !selectedVehicleId ? colors.textMuted : "#fff",
              fontSize: 18,
              fontWeight: "900",
              textAlign: "center",
              letterSpacing: 0.3,
            }}
          >
            {submitting
              ? "Submitting..."
              : !selectedVehicleId
              ? "Select Vehicle to Continue"
              : "🔵 Request Mechanics"}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );

  const renderSearching = () => (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Image
          source={require("../../assets/checklist.png")}
          style={{ width: 72, height: 72 }}
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ ...textStyles.title, textAlign: "center" }}>
        Finding Mechanics
      </Text>
      <View
        style={{
          padding: spacing.lg,
          borderRadius: 12,
          backgroundColor: colors.accent + "10",
          borderWidth: 1,
          borderColor: colors.accent + "30",
          maxWidth: 320,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.textMuted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          You&apos;re all set! I&apos;m notifying nearby mechanics right now. They&apos;ll review your request and send quotes soon. Hang tight!
        </Text>
      </View>
    </View>
  );

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
  handleBack(); // header doesn't use the boolean, hardware back does
};

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, gap: spacing.md }}>
      <Stack.Screen
        options={{
          title: getHeaderTitle(),
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 17,
          },
          headerShadowVisible: false,
          headerLeft:
            step !== "searching"
              ? () => (
                  <Pressable
                    onPress={onHeaderBackPress}
                    style={({ pressed }) => ({
                      padding: 8,
                      marginLeft: -5,
                      marginRight: 15,
                      opacity: pressed ? 0.5 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 20, color: colors.accent, lineHeight: 20 }}>
                      Back
                    </Text>
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
