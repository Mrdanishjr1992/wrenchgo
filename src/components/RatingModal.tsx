import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/ui/theme-context';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

type RatingModalProps = {
  visible: boolean;
  type: 'prompt' | 'confirmation';
  onRateApp?: () => void;
  onSnooze?: () => void;
  onFeedback?: () => void;
  onConfirmRated?: () => void;
  onConfirmNotYet?: () => void;
  onDismiss: () => void;
};

export function RatingModal({
  visible,
  type,
  onRateApp,
  onSnooze,
  onFeedback,
  onConfirmRated,
  onConfirmNotYet,
  onDismiss,
}: RatingModalProps) {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleFeedback = () => {
    onDismiss();
    router.push('/(customer)/support' as any);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={20}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        </Animated.View>

        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginBottom: insets.bottom + 20,
            },
          ]}
        >
          {type === 'prompt' ? (
            <>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="star" size={36} color={colors.accent} />
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Enjoying WrenchGo?
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                A quick rating helps other customers find trusted mechanics.
              </Text>

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  onPress={onRateApp}
                >
                  <Ionicons name="star" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Rate WrenchGo</Text>
                </Pressable>

                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onSnooze}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textMuted }]}>
                    Not now
                  </Text>
                </Pressable>

                <Pressable style={styles.tertiaryButton} onPress={onFeedback || handleFeedback}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.accent} />
                  <Text style={[styles.tertiaryButtonText, { color: colors.accent }]}>
                    Send feedback instead
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.iconContainer, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Did you leave a rating?
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                Thanks for taking the time! Your feedback helps us grow.
              </Text>

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
                  onPress={onConfirmRated}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Yes, I rated it!</Text>
                </Pressable>

                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onConfirmNotYet}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textMuted }]}>
                    Not yet
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    width: MODAL_WIDTH,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  tertiaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
