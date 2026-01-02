import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";

type SimpleCategory = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};
type Question = {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
};

type QuestionFlow = {
  [key: string]: Question[];
};

const SIMPLE_CATEGORIES: SimpleCategory[] = [
  {
    id: "wont-start",
    title: "Won't Start",
    icon: "power-outline",
    description: "Car won't turn on or start",
  },
  {
    id: "strange-noises",
    title: "Strange Noises",
    icon: "volume-high-outline",
    description: "Hearing unusual sounds",
  },
  {
    id: "warning-lights",
    title: "Warning Lights",
    icon: "warning-outline",
    description: "Dashboard lights are on",
  },
  {
    id: "leaking-fluids",
    title: "Leaking Fluids",
    icon: "water-outline",
    description: "Fluid under the car",
  },
  {
    id: "performance-issues",
    title: "Performance Issues",
    icon: "speedometer-outline",
    description: "Car feels sluggish or rough",
  },
  {
    id: "maintenance",
    title: "Regular Maintenance",
    icon: "build-outline",
    description: "Oil change, tune-up, etc.",
  },
  {
    id: "accident-damage",
    title: "Accident/Damage",
    icon: "car-outline",
    description: "Body work or collision repair",
  },
  {
    id: "other",
    title: "Something Else",
    icon: "help-circle-outline",
    description: "Describe your issue",
  },
];

const QUESTION_FLOWS: QuestionFlow = {
  "wont-start": [
    {
      id: "q1",
      question: "What happens when you turn the key?",
      type: "choice",
      options: ["Nothing at all", "Clicking sound", "Engine cranks but won't start", "Starts then dies"],
    },
    {
      id: "q2",
      question: "Are your dashboard lights working?",
      type: "choice",
      options: ["Yes, all lights work", "No lights at all", "Lights are dim"],
    },
  ],
  "strange-noises": [
    {
      id: "q1",
      question: "Where is the noise coming from?",
      type: "choice",
      options: ["Front of car", "Back of car", "Under the hood", "Inside the car", "Not sure"],
    },
    {
      id: "q2",
      question: "When do you hear it?",
      type: "choice",
      options: ["When braking", "When turning", "When accelerating", "All the time", "When idling"],
    },
    {
      id: "q3",
      question: "What does it sound like?",
      type: "choice",
      options: ["Squealing/Screeching", "Grinding", "Knocking/Tapping", "Rattling", "Humming/Whining"],
    },
  ],
  "warning-lights": [
    {
      id: "q1",
      question: "Which warning light is on?",
      type: "choice",
      options: ["Check Engine", "Oil", "Battery", "Brake", "Temperature", "ABS", "Tire Pressure", "Multiple lights"],
    },
    {
      id: "q2",
      question: "Is the light flashing or steady?",
      type: "choice",
      options: ["Flashing", "Steady on"],
    },
  ],
  "leaking-fluids": [
    {
      id: "q1",
      question: "What color is the fluid?",
      type: "choice",
      options: ["Clear/Water", "Brown/Black", "Red/Pink", "Green/Orange", "Yellow/Brown"],
    },
    {
      id: "q2",
      question: "Where is it leaking from?",
      type: "choice",
      options: ["Front of car", "Middle/Under car", "Back of car", "Not sure"],
    },
  ],
  "performance-issues": [
    {
      id: "q1",
      question: "What's the main problem?",
      type: "choice",
      options: ["Loss of power", "Rough idle", "Stalling", "Poor acceleration", "Vibration"],
    },
    {
      id: "q2",
      question: "When does it happen?",
      type: "choice",
      options: ["All the time", "Only when cold", "Only when hot", "During acceleration", "At highway speeds"],
    },
  ],
  "maintenance": [
    {
      id: "q1",
      question: "What service do you need?",
      type: "choice",
      options: ["Oil change", "Tire rotation", "Brake inspection", "Tune-up", "Fluid check", "Not sure"],
    },
    {
      id: "q2",
      question: "When was your last service?",
      type: "choice",
      options: ["Less than 3 months ago", "3-6 months ago", "6-12 months ago", "Over a year ago", "Don't remember"],
    },
  ],
  "accident-damage": [
    {
      id: "q1",
      question: "What type of damage?",
      type: "choice",
      options: ["Dent/Scratch", "Broken glass", "Bumper damage", "Multiple areas", "Frame damage"],
    },
    {
      id: "q2",
      question: "How severe is the damage?",
      type: "choice",
      options: ["Minor (cosmetic)", "Moderate (affects function)", "Severe (not drivable)"],
    },
  ],
  "other": [
    {
      id: "q1",
      question: "Please describe the issue",
      type: "text",
    },
  ],
};

export default function RequestService() {
  const { colors } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"category" | "questions" | "details">("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
      } else {
        router.replace("/(auth)/sign-in");
      }
    };
    getUser();
  }, []);

  const currentQuestions = selectedCategory ? QUESTION_FLOWS[selectedCategory] : [];
  const currentQuestion = currentQuestions[currentQuestionIndex];

  const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  };

  const text = {
    h2: { fontSize: 24, fontWeight: "700" as const, color: colors.textPrimary },
    h3: { fontSize: 20, fontWeight: "600" as const, color: colors.textPrimary },
    body: { fontSize: 16, fontWeight: "400" as const, color: colors.textPrimary },
    muted: { fontSize: 14, fontWeight: "400" as const, color: colors.textMuted },
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setStep("questions");
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStep("details");
    }
  };

  const handleBack = () => {
    if (step === "details") {
      setStep("questions");
      setCurrentQuestionIndex(currentQuestions.length - 1);
    } else if (step === "questions") {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      } else {
        setStep("category");
        setSelectedCategory(null);
      }
    } else {
      router.back();
    }
  };

  const generateProblemDescription = (): string => {
    const category = SIMPLE_CATEGORIES.find((c) => c.id === selectedCategory);
    if (!category) return "";

    let description = `${category.title}: `;
    const answerTexts = Object.values(answers);
    description += answerTexts.join(" | ");

    if (additionalDetails) {
      description += `\n\nAdditional details: ${additionalDetails}`;
    }

    return description;
  };

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to request service");
      return;
    }

    if (!location.trim()) {
      Alert.alert("Missing Information", "Please enter your location");
      return;
    }

    setLoading(true);

    try {
      const problemDescription = generateProblemDescription();

      const { error } = await supabase.from("service_requests").insert({
        customer_id: userId,
        description: problemDescription,
        location: location.trim(),
        status: "pending",
        category: selectedCategory,
      }).select().single();

      if (error) throw error;

      Alert.alert(
        "Success!",
        "Your service request has been sent to mechanics in your area. You'll receive quotes soon!",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error submitting request:", error);
      Alert.alert("Error", error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const renderCategorySelection = () => (
    <View style={{ flex: 1 }}>
      <Text style={{ ...text.h2, marginBottom: spacing.lg }}>What's wrong with your car?</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.md }}>
          {SIMPLE_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => handleCategorySelect(category.id)}
              style={{
                backgroundColor: colors.surface,
                padding: spacing.lg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.accent + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={category.icon} size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "600", marginBottom: 4 }}>{category.title}</Text>
                <Text style={{ ...text.muted, fontSize: 14 }}>{category.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderQuestions = () => {
    if (!currentQuestion) return null;

    return (
      <View style={{ flex: 1 }}>
        <View style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            {currentQuestions.map((_, index) => (
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
          <Text style={{ ...text.muted, fontSize: 14 }}>
            Question {currentQuestionIndex + 1} of {currentQuestions.length}
          </Text>
        </View>

        <Text style={{ ...text.h2, marginBottom: spacing.xl }}>{currentQuestion.question}</Text>

        {currentQuestion.type === "choice" && currentQuestion.options ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.md }}>
              {currentQuestion.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => handleAnswerSelect(option)}
                  style={{
                    backgroundColor: colors.surface,
                    padding: spacing.lg,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: answers[currentQuestion.id] === option ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    style={{
                      ...text.body,
                      color: answers[currentQuestion.id] === option ? colors.accent : colors.textPrimary,
                      fontWeight: answers[currentQuestion.id] === option ? "600" : "400",
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                padding: spacing.lg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                ...text.body,
                minHeight: 120,
                textAlignVertical: "top",
              }}
              placeholder="Type your answer here..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={answers[currentQuestion.id] || ""}
              onChangeText={(text) => setAnswers({ ...answers, [currentQuestion.id]: text })}
            />
            <TouchableOpacity
              onPress={() => handleAnswerSelect(answers[currentQuestion.id] || "")}
              disabled={!answers[currentQuestion.id]?.trim()}
              style={{
                backgroundColor: answers[currentQuestion.id]?.trim() ? colors.accent : colors.border,
                padding: spacing.md,
                borderRadius: 12,
                alignItems: "center",
                marginTop: spacing.lg,
              }}
            >
              <Text style={{ ...text.body, color: colors.surface, fontWeight: "600" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDetails = () => (
    <View style={{ flex: 1 }}>
      <Text style={{ ...text.h2, marginBottom: spacing.lg }}>Almost done!</Text>
      
      <View
        style={{
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.xl,
        }}
      >
        <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.sm }}>Your Issue Summary:</Text>
        <Text style={{ ...text.muted, fontSize: 14 }}>{generateProblemDescription()}</Text>
      </View>

      <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.sm }}>
        Where is your vehicle located?
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          ...text.body,
          marginBottom: spacing.lg,
        }}
        placeholder="Enter your address or zip code"
        placeholderTextColor={colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.sm }}>
        Anything else we should know? (Optional)
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          ...text.body,
          minHeight: 100,
          textAlignVertical: "top",
          marginBottom: spacing.xl,
        }}
        placeholder="Add any additional details..."
        placeholderTextColor={colors.textSecondary}
        multiline
        value={additionalDetails}
        onChangeText={setAdditionalDetails}
      />

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !location.trim()}
        style={{
          backgroundColor: loading || !location.trim() ? colors.border : colors.accent,
          padding: spacing.lg,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={{ ...text.body, color: colors.surface, fontWeight: "600" }}>
            Send to Mechanics
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={handleBack} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ ...text.h3, flex: 1 }}>Request Service</Text>
      </View>

      <View style={{ flex: 1, padding: spacing.lg }}>
        {step === "category" && renderCategorySelection()}
        {step === "questions" && renderQuestions()}
        {step === "details" && renderDetails()}
      </View>
    </View>
  );
}
