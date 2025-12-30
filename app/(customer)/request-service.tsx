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
  BackHandler
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

type Step = "education" | "questions" | "context" | "safety_measures" | "review" | "searching";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type SymptomData = {
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
  questions: {
    id: string;
    question: string;
    options: string[];
    explanation?: string;
  }[];
};

const symptomDatabase: Record<string, SymptomData> = {
  wont_start: {
    key: "wont_start",
    label: "Won't start",
    icon: "🚨",
    education: {
      title: "Car Won't Start",
      summary: "Most no-start issues are related to the battery, starter, or fuel system. A quick diagnosis can identify the exact cause.",
      is_it_safe: "Don't drive - needs diagnosis first",
      what_we_check: "Battery voltage, starter motor, fuel pump, ignition system",
      how_quotes_work: "Diagnostic fee first, then repair quote based on findings",
    },
    questions: [
      {
        id: "q1",
        question: "What happens when you turn the key?",
        options: ["Nothing at all", "Clicking sound", "Engine cranks but won't start", "Not sure"],
        explanation: "This helps identify if it's electrical or fuel-related",
      },
      {
        id: "q2",
        question: "Are your dashboard lights working?",
        options: ["Yes, normal", "Dim or flickering", "Not working", "Not sure"],
        explanation: "Dashboard lights indicate battery health",
      },
    ],
  },
  warning_light: {
    key: "warning_light",
    label: "Warning light",
    icon: "🔔",
    education: {
      title: "Warning Light On",
      summary: "Warning lights indicate your car's computer detected an issue. Some are urgent, others can wait. We'll help you understand what it means.",
      is_it_safe: "Depends on the light - we'll assess",
      what_we_check: "Diagnostic scan, sensor readings, system health",
      how_quotes_work: "Diagnostic scan first, then repair estimate",
    },
    questions: [
      {
        id: "q1",
        question: "Which light is on?",
        options: ["Check Engine", "ABS/Brake", "Oil pressure", "Battery", "Other/Multiple"],
      },
      {
        id: "q2",
        question: "Is the light solid or flashing?",
        options: ["Solid", "Flashing", "Not sure"],
        explanation: "Flashing lights usually indicate more urgent issues",
      },
    ],
  },
  brakes_wrong: {
    key: "brakes_wrong",
    label: "Brakes feel wrong",
    icon: "🛑",
    education: {
      title: "Brake Issues",
      summary: "Brake problems should never be ignored. Whether it's noise, soft pedal, or pulling, we'll inspect the entire system for safety.",
      is_it_safe: "Drive carefully - get checked ASAP",
      what_we_check: "Pads, rotors, fluid, calipers, brake lines",
      how_quotes_work: "Inspection first, then itemized repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What do you notice when braking?",
        options: ["Grinding noise", "Squealing", "Soft/spongy pedal", "Pulls to one side", "Vibration"],
      },
      {
        id: "q2",
        question: "How long has this been happening?",
        options: ["Just started", "Few days", "Few weeks", "Longer"],
      },
    ],
  },
  strange_noise: {
    key: "strange_noise",
    label: "Strange noise",
    icon: "🔊",
    education: {
      title: "Unusual Sounds",
      summary: "Different noises point to different issues. Describing when and where you hear it helps mechanics diagnose faster.",
      is_it_safe: "Usually safe to drive short distances",
      what_we_check: "Belts, bearings, exhaust, suspension components",
      how_quotes_work: "Diagnostic inspection, then repair estimate",
    },
    questions: [
      {
        id: "q1",
        question: "What kind of noise?",
        options: ["Squealing", "Grinding", "Knocking", "Rattling", "Humming", "Other"],
      },
      {
        id: "q2",
        question: "When do you hear it?",
        options: ["When starting", "While driving", "When turning", "When braking", "All the time"],
      },
    ],
  },
  fluid_leak: {
    key: "fluid_leak",
    label: "Fluid leak",
    icon: "💧",
    education: {
      title: "Fluid Leak",
      summary: "Different fluids mean different issues. The color and location help identify what's leaking and how urgent it is.",
      is_it_safe: "Depends on fluid type - we'll assess",
      what_we_check: "Leak source, fluid levels, hoses, seals",
      how_quotes_work: "Inspection to locate leak, then repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What color is the fluid?",
        options: ["Clear/water", "Green/yellow", "Red/pink", "Brown/black", "Not sure"],
      },
      {
        id: "q2",
        question: "Where is the puddle?",
        options: ["Front of car", "Middle", "Back", "Not sure"],
      },
    ],
  },
  battery_issues: {
    key: "battery_issues",
    label: "Battery issues",
    icon: "🔋",
    education: {
      title: "Battery Problems",
      summary: "Battery issues can be the battery itself, alternator, or electrical system. Testing will identify the root cause.",
      is_it_safe: "Safe to drive if it starts",
      what_we_check: "Battery voltage, alternator output, connections",
      how_quotes_work: "Quick test, then replacement or repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What's happening?",
        options: ["Slow to start", "Won't hold charge", "Electrical issues", "Battery light on"],
      },
      {
        id: "q2",
        question: "How old is your battery?",
        options: ["Less than 2 years", "2-4 years", "4+ years", "Not sure"],
      },
    ],
  },
  maintenance: {
    key: "maintenance",
    label: "Maintenance",
    icon: "🧰",
    education: {
      title: "Scheduled Maintenance",
      summary: "Regular maintenance keeps your car running smoothly and prevents bigger issues. We'll handle everything your car needs.",
      is_it_safe: "Safe to drive",
      what_we_check: "Based on your service needs",
      how_quotes_work: "Clear pricing for standard services",
    },
    questions: [
      {
        id: "q1",
        question: "What service do you need?",
        options: ["Oil change", "Tire rotation", "Brake inspection", "Full service", "Other"],
      },
    ],
  },
  not_sure: {
    key: "not_sure",
    label: "Not sure",
    icon: "❓",
    education: {
      title: "Need Diagnosis",
      summary: "No problem! Our mechanics will perform a thorough inspection to identify what's going on with your car.",
      is_it_safe: "We'll assess during diagnosis",
      what_we_check: "Complete vehicle inspection",
      how_quotes_work: "Diagnostic fee, then detailed findings and quote",
    },
    questions: [
      {
        id: "q1",
        question: "What made you concerned?",
        options: ["Something feels off", "Preventive check", "Recent issue", "Other"],
      },
    ],
  },
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

  const normalizeParam = (param: string | string[] | undefined): string | undefined => {
    if (!param) return undefined;
    if (Array.isArray(param)) return param[0];
    return param;
  };

  const textStyles = useMemo(
    () => ({
      title: { fontSize: normalize(24), fontWeight: "900" as const, color: colors.textPrimary },
      section: { fontSize: normalize(16), fontWeight: "800" as const, color: colors.textPrimary },
      body: { fontSize: normalize(14), fontWeight: "600" as const, color: colors.textPrimary },
      muted: { fontSize: normalize(13), fontWeight: "600" as const, color: colors.textMuted },
    }),
    [colors]
  );

  const [step, setStep] = useState<Step>("education");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleLoadError, setVehicleLoadError] = useState<string | null>(null);

  const symptomKey = normalizeParam(params.symptom) || "not_sure";
  const symptomData = symptomDatabase[symptomKey];

  const vehicleIdParam = normalizeParam(params.vehicleId);
  const vehicleYearParam = normalizeParam(params.vehicleYear);
  const vehicleMakeParam = normalizeParam(params.vehicleMake);
  const vehicleModelParam = normalizeParam(params.vehicleModel);
  const vehicleNicknameParam = normalizeParam(params.vehicleNickname);

  const hasVehicleParams = vehicleIdParam && vehicleYearParam && vehicleMakeParam && vehicleModelParam && isValidUUID(vehicleIdParam);

  console.log("🚗 RequestService: Params received", {
    symptom: symptomKey,
    vehicleIdParam,
    vehicleYearParam,
    vehicleMakeParam,
    vehicleModelParam,
    hasVehicleParams,
    isValidUUID: vehicleIdParam ? isValidUUID(vehicleIdParam) : false,
  });

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
      setVehicleLoadError(e.message || "Unable to load vehicles. Please check your connection and try again.");
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
  }, [hasVehicleParams, vehicleIdParam, vehicleYearParam, vehicleMakeParam, vehicleModelParam, vehicleNicknameParam]);

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
    if (step === "review" && !selectedVehicleId && vehicles.length !== 1) {
      setShowVehicleDrawer(true);
    }
  }, [step, selectedVehicleId, vehicles.length]);

  const handleChangeVehicle = () => {
    setShowVehicleDrawer(true);
  };

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
    } else if (step === "questions") {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      } else {
        setStep("education");
      }
      return true;
    } else if (step === "context") {
      if (symptomData.questions.length > 0) {
        setStep("questions");
        setCurrentQuestionIndex(symptomData.questions.length - 1);
      } else {
        setStep("education");
      }
      return true;
    } else if (step === "safety_measures") {
      setStep("context");
      return true;
    } else if (step === "review") {
      setStep("safety_measures");
      return true;
    } else if (step === "searching") {
      return true;
    }
    return false;
  }, [step, currentQuestionIndex, symptomData.questions.length]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  if (!symptomData) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <Text style={textStyles.body}>Invalid symptom</Text>
      </View>
    );
  }

  const handleContinueFromEducation = () => {
    if (symptomData.questions.length > 0) {
      setStep("questions");
    } else {
      setStep("context");
    }
  };

  const handleAnswerQuestion = (answer: string) => {
    const currentQuestion = symptomData.questions[currentQuestionIndex];
    setAnswers({ ...answers, [currentQuestion.id]: answer });

    if (currentQuestionIndex < symptomData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStep("context");
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!symptomData || !symptomData.label) {
        Alert.alert("Missing Information", "Please select a symptom to continue.");
        setSubmitting(false);
        return;
      }

      if (!canMove || !locationType) {
        Alert.alert("Missing Information", "Please provide context about your vehicle's condition and location.");
        setSubmitting(false);
        setStep("context");
        return;
      }

      const allSafetyChecked = Object.values(safetyChecks).every((v) => v === true);
      if (!allSafetyChecked) {
        Alert.alert("Safety Checklist", "Please complete all safety checks before submitting.");
        setSubmitting(false);
        setStep("safety_measures");
        return;
      }

      if (!selectedVehicleId || !isValidUUID(selectedVehicleId)) {
        Alert.alert("Vehicle Required", "Please select a valid vehicle before submitting your request.");
        setSubmitting(false);
        setShowVehicleDrawer(true);
        setStep("review");
        return;
      }

      if (!selectedVehicle) {
        Alert.alert("Vehicle Required", "Vehicle information is missing. Please select a vehicle.");
        setSubmitting(false);
        setShowVehicleDrawer(true);
        setStep("review");
        return;
      }

      setStep("searching");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

      // Check ID verification status
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id_status")
        .eq("id", userId)
        .single();

      if (profileError) {
        Alert.alert("Error", "Failed to verify your account status. Please try again.");
        setSubmitting(false);
        setStep("review");
        return;
      }

      if (profileData.id_status !== "verified") {
        Alert.alert(
          "ID Verification Required",
          "You need to verify your photo ID before requesting a mechanic. This helps ensure safety and trust for all users.",
          [
            {
              text: "Verify Now",
              onPress: () => {
                setSubmitting(false);
                router.push("/(auth)/photo-id");
              },
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                setSubmitting(false);
                setStep("review");
              },
            },
          ]
        );
        return;
      }

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
        setSubmitting(false);
        setStep("review");
        return;
      }

      if (vehicleCheck.customer_id !== userId) {
        Alert.alert(
          "Invalid Vehicle",
          "This vehicle does not belong to your account. Please select a valid vehicle.",
          [{ text: "OK", onPress: () => setShowVehicleDrawer(true) }]
        );
        setSubmitting(false);
        setStep("review");
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Location permission is needed.");
        setSubmitting(false);
        setStep("review");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const wkt = `POINT(${pos.coords.longitude} ${pos.coords.latitude})`;

      console.log("🚗 Vehicle Debug:", {
        selectedVehicleId,
        selectedVehicle,
        isValidUUID: isValidUUID(selectedVehicleId),
        ownershipVerified: true,
      });

      let intake;
      try {
        intake = {
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
      } catch (vehicleConstructionError) {
        console.error("❌ Vehicle object construction failed:", vehicleConstructionError);
        Alert.alert(
          "Vehicle Error",
          "Failed to process vehicle information. Please select your vehicle again.",
          [{ text: "OK", onPress: () => setShowVehicleDrawer(true) }]
        );
        setSubmitting(false);
        setStep("review");
        return;
      }

      const jobPayload = {
        customer_id: userId,
        title: symptomData.label,
        description: JSON.stringify(intake),
        status: "searching",
        location: wkt,
        vehicle_id: selectedVehicleId,
      };

      console.log("📝 Job Insert Payload:", jobPayload);

      const { data: insertedJob, error } = await supabase
        .from("jobs")
        .insert(jobPayload)
        .select("id, vehicle_id")
        .single();

      if (error) {
        console.error("❌ Job Insert Error:", error);
        throw error;
      }

      console.log("✅ Job Created:", insertedJob);

      if (selectedVehicleId && !insertedJob.vehicle_id) {
        console.warn("⚠️ WARNING: vehicle_id was provided but not saved!", {
          providedVehicleId: selectedVehicleId,
          savedVehicleId: insertedJob.vehicle_id,
          jobId: insertedJob.id,
        });
        Alert.alert(
          "Warning",
          "Job created but vehicle information may not have been saved. Please contact support if needed.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(customer)/(tabs)/index" as any),
            },
          ]
        );
        return;
      }

      setTimeout(() => {
        Alert.alert("Request sent!", "We're notifying nearby mechanics.");
        router.replace("/(customer)/(tabs)/jobs" as any);
      }, 2000);
    } catch (e: any) {
      console.error("❌ Job Creation Failed:", e);
      Alert.alert("Error", e?.message ?? "Failed to create request. Please try again.");
      setStep("review");
    } finally {
      setSubmitting(false);
    }
  };

  const renderEducation = () => {
    const safetyColor = symptomData.education.is_it_safe.toLowerCase().includes("safe")
      ? "#10b981"
      : symptomData.education.is_it_safe.toLowerCase().includes("don't")
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

        <View style={{ 
          alignItems: "center", 
          gap: spacing.md, 
          marginTop: spacing.sm 
          }}>
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
              <Text style={{ fontSize: 13, fontWeight: "700", color: safetyColor, flex: 1, lineHeight: 18 }}>
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
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accent, flex: 1, lineHeight: 18 }}>
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
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, flex: 1, lineHeight: 18 }}>
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
              backgroundColor: colors.accent ,
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
    const currentQuestion = symptomData.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / symptomData.questions.length) * 100;

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
            Question {currentQuestionIndex + 1} of {symptomData.questions.length}
          </Text>
        </View>

        <Text style={{ ...textStyles.title, fontSize: 20 }}>
          {currentQuestion.question}
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

        {currentQuestion.explanation && (
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
              💡 {currentQuestion.explanation}
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          {currentQuestion.options.map((option) => (
            <Pressable
              key={option}
              onPress={() => handleAnswerQuestion(option)}
              style={({ pressed }) => [
                card,
                pressed && cardPressed,
                {
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
            >
              <Text style={textStyles.body}>{option}</Text>
              <Text style={{ fontSize: 18, color: colors.textMuted }}>›</Text>
            </Pressable>
          ))}
        </View>
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
              🚗 Vehicle: {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : "Not selected"}
            </Text>
            <Text style={textStyles.muted}>
              📍 Location: {locationType || "Not set"}
            </Text>
            <Text style={textStyles.muted}>
              🔧 Issue: {symptomData.label}
            </Text>
            <Text style={textStyles.muted}>
              🚙 Can move: {canMove || "Not set"}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Pressable
            onPress={() => setSafetyChecks({ ...safetyChecks, vehicleConfirmed: !safetyChecks.vehicleConfirmed })}
            style={[
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: safetyChecks.vehicleConfirmed ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: safetyChecks.vehicleConfirmed ? colors.accent : colors.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {safetyChecks.vehicleConfirmed && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...textStyles.body, fontWeight: "800" }}>
                I confirm this is the correct vehicle
              </Text>
              <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>
                {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : "No vehicle selected"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSafetyChecks({ ...safetyChecks, locationAccurate: !safetyChecks.locationAccurate })}
            style={[
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: safetyChecks.locationAccurate ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: safetyChecks.locationAccurate ? colors.accent : colors.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {safetyChecks.locationAccurate && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...textStyles.body, fontWeight: "800" }}>
                My location is accurate
              </Text>
              <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>
                Mechanics will use your location to find you
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSafetyChecks({ ...safetyChecks, availableForContact: !safetyChecks.availableForContact })}
            style={[
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: safetyChecks.availableForContact ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: safetyChecks.availableForContact ? colors.accent : colors.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {safetyChecks.availableForContact && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...textStyles.body, fontWeight: "800" }}>
                I&apos;m available to respond to mechanics
              </Text>
              <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>
                Check your messages for quotes and questions
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSafetyChecks({ ...safetyChecks, understandsProcess: !safetyChecks.understandsProcess })}
            style={[
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: safetyChecks.understandsProcess ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: safetyChecks.understandsProcess ? colors.accent : colors.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {safetyChecks.understandsProcess && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...textStyles.body, fontWeight: "800" }}>
                I understand the quote process
              </Text>
              <Text style={{ ...textStyles.muted, fontSize: 12, marginTop: 2 }}>
                No payment until you accept a quote
              </Text>
            </View>
          </Pressable>
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
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary, textAlign: "center" }}>

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
              {Object.entries(answers).map(([qId, answer]) => {
                const q = symptomData.questions.find((q) => q.id === qId);
                return (
                  <View key={qId} style={{ marginTop: spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {q?.question}
                    </Text>
                    <Text style={{ ...textStyles.body, marginTop: 2 }}>{answer}</Text>
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
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary}}> 
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
            {submitting ? "Submitting..." : !selectedVehicleId ? "Select Vehicle to Continue" : "🔵 Request Mechanics"}
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
          headerLeft: step !== "searching" ? () => (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => ({
                padding: 8,
                marginLeft: -5,
                marginRight: 15,
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 20, color: colors.accent, lineHeight: 20 }}>Back</Text>
            </Pressable>
          ) : undefined,
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
