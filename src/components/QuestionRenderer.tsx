import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../ui/theme-context';
import { createCard, cardPressed } from '../ui/styles';
import type { SymptomQuestion } from '../hooks/use-symptom-questions';

export interface QuestionRendererProps {
  question: SymptomQuestion;
  value?: string | string[];
  onAnswer: (answer: string | string[]) => void;
}

export default function QuestionRenderer({ question, value, onAnswer }: QuestionRendererProps) {
  const { colors, spacing } = useTheme();
  const card = createCard(colors);

  const renderYesNo = () => (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {['Yes', 'No'].map((option) => (
        <Pressable
          key={option}
          onPress={() => {
            onChange(option);
            setTimeout(onNext, 300);
          }}
          style={[
            card,
            {
              flex: 1,
              padding: spacing.lg,
              backgroundColor: colors.bg,
              borderWidth: 2,
              borderColor: value === option ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: value === option ? '900' : '600',
              color: value === option ? colors.accent : colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderSingleChoice = () => (
    <View style={{ gap: spacing.sm }}>
      {question.options.map((option) => (
        <Pressable
          key={option}
          onPress={() => {
            onChange(option);
            setTimeout(onNext, 300);
          }}
          style={({ pressed }) => [
            card,
            pressed && cardPressed,
            {
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: value === option ? colors.accent + '15' : colors.bg,
              borderWidth: 2,
              borderColor: value === option ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: value === option ? '800' : '600',
              color: value === option ? colors.accent : colors.textPrimary,
            }}
          >
            {option}
          </Text>
          {value === option && <Text style={{ fontSize: 18, color: colors.accent }}>✓</Text>}
        </Pressable>
      ))}
    </View>
  );

  const renderMultiChoice = () => {
    const selectedValues = Array.isArray(value) ? value : [];

    const toggleOption = (option: string) => {
      if (selectedValues.includes(option)) {
        onChange(selectedValues.filter((v) => v !== option));
      } else {
        onChange([...selectedValues, option]);
      }
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {question.options.map((option) => {
          const isSelected = selectedValues.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => toggleOption(option)}
              style={({ pressed }) => [
                card,
                pressed && cardPressed,
                {
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isSelected ? colors.accent + '15' : colors.bg,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: isSelected ? '800' : '600',
                  color: isSelected ? colors.accent : colors.textPrimary,
                }}
              >
                {option}
              </Text>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accent : colors.border,
                  backgroundColor: isSelected ? colors.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && <Text style={{ fontSize: 14, color: '#fff' }}>✓</Text>}
              </View>
            </Pressable>
          );
        })}
        {selectedValues.length > 0 && (
          <Pressable
            onPress={onNext}
            style={[
              card,
              {
                padding: spacing.md,
                backgroundColor: colors.accent,
                alignItems: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>
              Continue ({selectedValues.length} selected)
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderNumeric = () => (
    <View>
      <TextInput
        value={value || ''}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="Enter a number"
        placeholderTextColor={colors.textMuted}
        style={[
          card,
          {
            padding: spacing.md,
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary,
            backgroundColor: colors.bg,
            borderWidth: 2,
            borderColor: colors.border,
          },
        ]}
      />
      {value && (
        <Pressable
          onPress={onNext}
          style={[
            card,
            {
              padding: spacing.md,
              backgroundColor: colors.accent,
              alignItems: 'center',
              marginTop: spacing.sm,
            },
          ]}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>Continue</Text>
        </Pressable>
      )}
    </View>
  );

  const renderPhoto = () => {
    const pickImage = async () => {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    };

    const takePhoto = async () => {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your camera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {value && (
          <View
            style={[
              card,
              {
                padding: spacing.sm,
                backgroundColor: colors.bg,
                borderWidth: 2,
                borderColor: colors.accent,
              },
            ]}
          >
            <Image
              source={{ uri: value }}
              style={{ width: '100%', height: 200, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={takePhoto}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.accent,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>📷 Take Photo</Text>
          </Pressable>
          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.border,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: colors.textPrimary }}>
              🖼️ Choose
            </Text>
          </Pressable>
        </View>
        {value && (
          <Pressable
            onPress={onNext}
            style={[
              card,
              {
                padding: spacing.md,
                backgroundColor: colors.accent,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>Continue</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderAudio = () => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = async () => {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Please allow access to your microphone.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        setRecording(newRecording);
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording', err);
        Alert.alert('Error', 'Failed to start recording');
      }
    };

    const stopRecording = async () => {
      if (!recording) return;

      try {
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        onChange(uri);
        setRecording(null);
      } catch (err) {
        console.error('Failed to stop recording', err);
      }
    };

    return (
      <View style={{ gap: spacing.sm }}>
        {value && (
          <View
            style={[
              card,
              {
                padding: spacing.md,
                backgroundColor: colors.accent + '15',
                borderWidth: 2,
                borderColor: colors.accent,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accent }}>
              ✓ Audio recorded
            </Text>
          </View>
        )}
        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          style={[
            card,
            {
              padding: spacing.lg,
              backgroundColor: isRecording ? '#ef4444' : colors.accent,
              alignItems: 'center',
            },
          ]}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>
            {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
          </Text>
        </Pressable>
        {value && !isRecording && (
          <Pressable
            onPress={onNext}
            style={[
              card,
              {
                padding: spacing.md,
                backgroundColor: colors.accent,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>Continue</Text>
          </Pressable>
        )}
      </View>
    );
  };

  switch (question.question_type) {
    case 'yes_no':
      return renderYesNo();
    case 'single_choice':
      return renderSingleChoice();
    case 'multi_choice':
      return renderMultiChoice();
    case 'numeric':
      return renderNumeric();
    case 'photo':
      return renderPhoto();
    case 'audio':
      return renderAudio();
    default:
      return (
        <Text style={{ color: colors.textMuted }}>
          Unsupported question type: {question.question_type}
        </Text>
      );
  }
}
