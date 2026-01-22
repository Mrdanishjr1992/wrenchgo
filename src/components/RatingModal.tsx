import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  TextInput,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/ui/theme-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);

const APP_STORE_ID = '';
const PLAY_STORE_ID = 'com.wrenchgo.app';

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

function AnimatedStar({
  index,
  rating,
  onPress,
  colors,
}: {
  index: number;
  rating: number;
  onPress: (rating: number) => void;
  colors: any;
}) {
  const scale = useSharedValue(1);
  const filled = index <= rating;

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 20, stiffness: 300 })
    );
    onPress(index);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={40}
          color={filled ? '#FFD700' : colors.border}
        />
      </Animated.View>
    </Pressable>
  );
}

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
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'rate' | 'review' | 'thanks'>('rate');

  const resetState = () => {
    setRating(0);
    setReview('');
    setStep('rate');
    setSubmitting(false);
  };

  const handleDismiss = () => {
    resetState();
    onDismiss();
  };

  const handleStarPress = (starRating: number) => {
    setRating(starRating);
  };

  const handleContinue = () => {
    if (rating === 0) return;
    setStep('review');
  };

  const openAppStore = async () => {
    const canUseNative = await StoreReview.isAvailableAsync();

    if (canUseNative) {
      try {
        await StoreReview.requestReview();
        return true;
      } catch (err) {
        console.error('StoreReview error:', err);
      }
    }

    const storeUrl = Platform.select({
      ios: `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
      android: `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`,
      default: '',
    });

    if (storeUrl) {
      try {
        await Linking.openURL(storeUrl);
        return true;
      } catch (err) {
        console.error('Failed to open store:', err);
      }
    }
    return false;
  };

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitting(true);

    try {
      if (onRateApp) {
        onRateApp();
      }

      await openAppStore();

      setStep('thanks');
    } catch (err) {
      console.error('Error submitting rating:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (onConfirmRated) {
      onConfirmRated();
    }
    resetState();
    onDismiss();
  };

  if (!visible) return null;

  const getRatingLabel = () => {
    if (rating === 0) return 'Tap a star to rate';
    if (rating === 1) return 'We can do better';
    if (rating === 2) return 'Not great';
    if (rating === 3) return 'It\'s okay';
    if (rating === 4) return 'Pretty good!';
    return 'Excellent!';
  };

  const getRatingEmoji = () => {
    if (rating === 0) return '🤔';
    if (rating === 1) return '😞';
    if (rating === 2) return '😕';
    if (rating === 3) return '😊';
    if (rating === 4) return '😄';
    return '🤩';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
        </Animated.View>

        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

        <Animated.View
          entering={SlideInDown.springify().damping(25).stiffness(200)}
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
          {type === 'confirmation' ? (
            <>
              <View style={[styles.iconContainer, { backgroundColor: colors.successBg || '#10B98120' }]}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success || '#10B981'} />
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Thanks for rating!
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                Your feedback helps us improve WrenchGo for everyone.
              </Text>

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  onPress={onConfirmRated}
                >
                  <Text style={[styles.primaryButtonText, { color: '#000' }]}>Done</Text>
                </Pressable>
              </View>
            </>
          ) : step === 'rate' ? (
            <>
              <View style={[styles.emojiContainer]}>
                <Text style={styles.emoji}>{getRatingEmoji()}</Text>
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Rate WrenchGo
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                How would you rate your experience?
              </Text>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <AnimatedStar
                    key={star}
                    index={star}
                    rating={rating}
                    onPress={handleStarPress}
                    colors={colors}
                  />
                ))}
              </View>

              <Text style={[styles.ratingLabel, { color: rating > 0 ? colors.accent : colors.textMuted }]}>
                {getRatingLabel()}
              </Text>

              <View style={styles.buttons}>
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: rating > 0 ? colors.accent : colors.border },
                  ]}
                  onPress={handleContinue}
                  disabled={rating === 0}
                >
                  <Text style={[styles.primaryButtonText, { color: rating > 0 ? '#000' : colors.textMuted }]}>
                    Continue
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onSnooze}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textMuted }]}>
                    Maybe later
                  </Text>
                </Pressable>
              </View>
            </>
          ) : step === 'review' ? (
            <>
              <View style={styles.miniStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={20}
                    color={star <= rating ? '#FFD700' : colors.border}
                  />
                ))}
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {rating >= 4 ? 'Awesome!' : 'Tell us more'}
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                {rating >= 4
                  ? 'Would you mind sharing your experience on the App Store?'
                  : 'What could we do better? Your feedback helps us improve.'}
              </Text>

              <TextInput
                style={[
                  styles.reviewInput,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Share your thoughts (optional)..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={review}
                onChangeText={setReview}
                textAlignVertical="top"
              />

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="arrow-forward" size={18} color="#000" />
                      <Text style={[styles.primaryButtonText, { color: '#000' }]}>
                        {rating >= 4 ? 'Rate on App Store' : 'Submit Feedback'}
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.backButton}
                  onPress={() => setStep('rate')}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                  <Text style={[styles.backButtonText, { color: colors.textMuted }]}>
                    Back
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="heart" size={36} color="#10B981" />
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Thank you!
              </Text>

              <Text style={[styles.body, { color: colors.textMuted }]}>
                Your feedback means the world to us. We're constantly working to make WrenchGo better.
              </Text>

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  onPress={handleFinish}
                >
                  <Text style={[styles.primaryButtonText, { color: '#000' }]}>Done</Text>
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
  emojiContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  miniStarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 24,
  },
  reviewInput: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
