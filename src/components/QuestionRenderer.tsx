import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { useTheme } from "../ui/theme-context";
import { createCard, cardPressed } from "../ui/styles";

export type SymptomQuestion = {
  question_key: string;
  question_label: string;
  question_type: string;
  options: string[];
};

export interface QuestionRendererProps {
  question: SymptomQuestion;
  value?: string | string[];
  onAnswer: (answer: string | string[]) => void;
}

export default function QuestionRenderer({ question, value, onAnswer }: QuestionRendererProps) {
  const { colors, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const type = (question.question_type || "").toLowerCase().trim();

  // Multi-choice state at component level
  const [localSelected, setLocalSelected] = useState<string[]>(
    Array.isArray(value) ? value : []
  );

  // Audio state at component level
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const renderYesNo = () => (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {["Yes", "No"].map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onAnswer(opt)}
            style={[
              card,
              {
                flex: 1,
                padding: spacing.lg,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: selected ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: selected ? "900" : "600",
                color: selected ? colors.accent : colors.textPrimary,
                textAlign: "center",
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderSingleChoice = () => (
    <View style={{ gap: spacing.sm }}>
      {(question.options || []).map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onAnswer(opt)}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: selected ? colors.accent + "15" : colors.bg,
                borderWidth: 2,
                borderColor: selected ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: selected ? "800" : "600", color: selected ? colors.accent : colors.textPrimary }}>
              {opt}
            </Text>
            {selected && <Text style={{ fontSize: 18, color: colors.accent }}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );

  const renderMultiChoice = () => {
    const toggle = (opt: string) => {
      const next = localSelected.includes(opt) ? localSelected.filter((x) => x !== opt) : [...localSelected, opt];
      setLocalSelected(next);
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {(question.options || []).map((opt) => {
          const isSelected = localSelected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              style={({ pressed }) => [
                card,
                pressed && cardPressed,
                {
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isSelected ? colors.accent + "15" : colors.bg,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 15, fontWeight: isSelected ? "800" : "600", color: isSelected ? colors.accent : colors.textPrimary }}>
                {opt}
              </Text>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accent : colors.border,
                  backgroundColor: isSelected ? colors.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && <Text style={{ fontSize: 14, color: "#fff" }}>✓</Text>}
              </View>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => onAnswer(localSelected)}
          disabled={localSelected.length === 0}
          style={({ pressed }) => [
            card,
            {
              padding: spacing.md,
              backgroundColor: localSelected.length === 0 ? colors.border : colors.accent,
              alignItems: "center",
              marginTop: spacing.sm,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 15, fontWeight: "900", color: localSelected.length === 0 ? colors.textMuted : "#fff" }}>
            Continue ({localSelected.length} selected)
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderNumeric = () => {
    const str = typeof value === "string" ? value : "";
    return (
      <View style={{ gap: spacing.sm }}>
        <TextInput
          value={str}
          onChangeText={(t) => onAnswer(t)}
          keyboardType="numeric"
          placeholder="Enter a number"
          placeholderTextColor={colors.textMuted}
          style={[
            card,
            {
              padding: spacing.md,
              fontSize: 16,
              fontWeight: "600",
              color: colors.textPrimary,
              backgroundColor: colors.bg,
              borderWidth: 2,
              borderColor: colors.border,
            },
          ]}
        />

        <Pressable
          onPress={() => onAnswer(str)}
          disabled={!str}
          style={[
            card,
            {
              padding: spacing.md,
              backgroundColor: str ? colors.accent : colors.border,
              alignItems: "center",
            },
          ]}
        >
          <Text style={{ fontSize: 15, fontWeight: "900", color: str ? "#fff" : colors.textMuted }}>Continue</Text>
        </Pressable>
      </View>
    );
  };

  const renderPhoto = () => {
    const uri = typeof value === "string" ? value : "";

    const pickImage = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission Required", "Please allow access to your photo library.");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) onAnswer(result.assets[0].uri);
    };

    const takePhoto = async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission Required", "Please allow access to your camera.");

      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) onAnswer(result.assets[0].uri);
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {!!uri && (
          <View style={[card, { padding: spacing.sm, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.accent }]}>
            <Image source={{ uri }} style={{ width: "100%", height: 200, borderRadius: 12 }} resizeMode="cover" />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            onPress={takePhoto}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              { flex: 1, padding: spacing.md, backgroundColor: colors.accent, alignItems: "center" },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: "900", color: "#fff" }}>📷 Take Photo</Text>
          </Pressable>

          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              { flex: 1, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center" },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: "900", color: colors.textPrimary }}>🖼️ Choose</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => onAnswer(uri)}
          disabled={!uri}
          style={[card, { padding: spacing.md, backgroundColor: uri ? colors.accent : colors.border, alignItems: "center" }]}
        >
          <Text style={{ fontSize: 15, fontWeight: "900", color: uri ? "#fff" : colors.textMuted }}>Continue</Text>
        </Pressable>
      </View>
    );
  };

  const renderAudio = () => {
    const uri = typeof value === "string" ? value : "";

    const startRecording = async () => {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission Required", "Please allow access to your microphone.");

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    };

    const stopRecording = async () => {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const out = recording.getURI();
      setRecording(null);
      if (out) onAnswer(out);
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {!!uri && (
          <View style={[card, { padding: spacing.md, backgroundColor: colors.accent + "15", borderWidth: 2, borderColor: colors.accent, alignItems: "center" }]}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.accent }}>✓ Audio recorded</Text>
          </View>
        )}

        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          style={[card, { padding: spacing.lg, backgroundColor: isRecording ? colors.error : colors.accent, alignItems: "center" }]}
        >
          <Text style={{ fontSize: 15, fontWeight: "900", color: colors.white }}>
            {isRecording ? "⏹️ Stop Recording" : "🎤 Start Recording"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onAnswer(uri)}
          disabled={!uri || isRecording}
          style={[card, { padding: spacing.md, backgroundColor: uri && !isRecording ? colors.accent : colors.border, alignItems: "center" }]}
        >
          <Text style={{ fontSize: 15, fontWeight: "900", color: uri && !isRecording ? colors.white : colors.textMuted }}>Continue</Text>
        </Pressable>
      </View>
    );
  };

  switch (type) {
    case "yes_no":
      return renderYesNo();
    case "single":
    case "single_choice":
      return renderSingleChoice();
    case "multi":
    case "multi_choice":
      return renderMultiChoice();
    case "numeric":
      return renderNumeric();
    case "photo":
      return renderPhoto();
    case "audio":
      return renderAudio();
    default:
      return <Text style={{ color: colors.textMuted }}>Unsupported question type: {question.question_type}</Text>;
  }
}
