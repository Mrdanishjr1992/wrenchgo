// src/onboarding/WalkthroughOverlay.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from './useOnboarding';
import { useTheme } from '../ui/theme-context';
import type { TargetMeasurement } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_BORDER_RADIUS = 12;
const TOOLTIP_WIDTH = Math.min(SCREEN_WIDTH - 48, 320);
const TOOLTIP_OFFSET = 16;

type TooltipPosition = 'above' | 'below';

function calculateTooltipPosition(
  target: TargetMeasurement | null,
  tooltipHeight: number,
  insets: { top: number; bottom: number }
): { top: number; position: TooltipPosition } {
  if (!target) {
    // Center fallback
    return {
      top: (SCREEN_HEIGHT - tooltipHeight) / 2,
      position: 'below',
    };
  }

  const targetCenterY = target.pageY + target.height / 2;
  const spaceAbove = target.pageY - insets.top - TOOLTIP_OFFSET;
  const spaceBelow = SCREEN_HEIGHT - (target.pageY + target.height) - insets.bottom - TOOLTIP_OFFSET;

  // Prefer below, but go above if not enough space
  if (spaceBelow >= tooltipHeight) {
    return {
      top: target.pageY + target.height + TOOLTIP_OFFSET,
      position: 'below',
    };
  } else if (spaceAbove >= tooltipHeight) {
    return {
      top: target.pageY - tooltipHeight - TOOLTIP_OFFSET,
      position: 'above',
    };
  } else {
    // Not enough space either way, center it
    return {
      top: Math.max(insets.top + 20, (SCREEN_HEIGHT - tooltipHeight) / 2),
      position: 'below',
    };
  }
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  
  return (
    <View style={styles.progressDots} accessibilityLabel={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === current ? colors.accent : colors.textMuted + '40',
            },
          ]}
        />
      ))}
    </View>
  );
}

export function WalkthroughOverlay() {
  const {
    isWalkthroughActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    getTargetMeasurement,
    nextStep,
    prevStep,
    skipWalkthrough,
  } = useOnboarding();
  
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();
  const [tooltipHeight, setTooltipHeight] = useState(180);

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const tooltipScale = useSharedValue(0.9);
  const spotlightX = useSharedValue(0);
  const spotlightY = useSharedValue(0);
  const spotlightWidth = useSharedValue(0);
  const spotlightHeight = useSharedValue(0);

  const targetMeasurement = currentStep
    ? getTargetMeasurement(currentStep.targetId)
    : null;

  // Calculate spotlight and tooltip positions
  const { tooltipTop, tooltipPosition } = useMemo(() => {
    const result = calculateTooltipPosition(targetMeasurement, tooltipHeight, insets);
    return {
      tooltipTop: result.top,
      tooltipPosition: result.position,
    };
  }, [targetMeasurement, tooltipHeight, insets]);

  // Animate when step changes
  useEffect(() => {
    if (!isWalkthroughActive) {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      return;
    }

    overlayOpacity.value = withTiming(1, { duration: 300 });
    tooltipScale.value = 0.9;
    tooltipScale.value = withSpring(1, { damping: 15, stiffness: 200 });

    if (targetMeasurement) {
      spotlightX.value = withTiming(targetMeasurement.pageX - SPOTLIGHT_PADDING, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      spotlightY.value = withTiming(targetMeasurement.pageY - SPOTLIGHT_PADDING, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      spotlightWidth.value = withTiming(targetMeasurement.width + SPOTLIGHT_PADDING * 2, {
        duration: 300,
      });
      spotlightHeight.value = withTiming(targetMeasurement.height + SPOTLIGHT_PADDING * 2, {
        duration: 300,
      });
    } else {
      // No target found - hide spotlight
      spotlightWidth.value = withTiming(0, { duration: 200 });
      spotlightHeight.value = withTiming(0, { duration: 200 });
    }
  }, [isWalkthroughActive, currentStepIndex, targetMeasurement]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tooltipScale.value }],
  }));

  const spotlightAnimatedStyle = useAnimatedStyle(() => ({
    left: spotlightX.value,
    top: spotlightY.value,
    width: spotlightWidth.value,
    height: spotlightHeight.value,
  }));

  if (!isWalkthroughActive || !currentStep) {
    return null;
  }

  const tooltipBg = isDark ? colors.surface2 : colors.surface;
  const tooltipTextColor = colors.textPrimary;
  const tooltipBodyColor = colors.textSecondary;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <Animated.View
      style={[styles.container, overlayStyle]}
      pointerEvents="box-none"
    >
      {/* Dim overlay with spotlight cutout */}
      <View style={styles.dimOverlay} pointerEvents="box-none">
        {/* We use a semi-transparent background and position a "hole" */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />

        {/* Spotlight highlight */}
        {targetMeasurement && (
          <Animated.View
            style={[styles.spotlight, spotlightAnimatedStyle]}
            pointerEvents="none"
          >
            <View style={[styles.spotlightInner, { borderColor: colors.highlight, shadowColor: colors.highlight }]} />
          </Animated.View>
        )}
      </View>

      {/* Tooltip */}
      <Animated.View
        style={[
          styles.tooltip,
          tooltipAnimatedStyle,
          {
            top: tooltipTop,
            left: (SCREEN_WIDTH - TOOLTIP_WIDTH) / 2,
            width: TOOLTIP_WIDTH,
            backgroundColor: tooltipBg,
            shadowColor: colors.black,
          },
        ]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
        accessibilityRole="alert"
        accessibilityLabel={`${currentStep.title}. ${currentStep.body}`}
      >
        {/* Arrow indicator */}
        {targetMeasurement && (
          <View
            style={[
              styles.tooltipArrow,
              tooltipPosition === 'above' ? styles.arrowDown : styles.arrowUp,
              {
                backgroundColor: tooltipBg,
                left: TOOLTIP_WIDTH / 2 - 10,
              },
            ]}
          />
        )}

        <Text style={[styles.tooltipTitle, { color: tooltipTextColor }]}>
          {currentStep.title}
        </Text>
        <Text style={[styles.tooltipBody, { color: tooltipBodyColor }]}>
          {currentStep.body}
        </Text>

        <ProgressDots current={currentStepIndex} total={totalSteps} />

        <View style={styles.buttonRow}>
          <Pressable
            onPress={skipWalkthrough}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip tour"
            hitSlop={12}
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>

          <View style={styles.navButtons}>
            {!isFirstStep && (
              <Pressable
                onPress={prevStep}
                style={[styles.navButton, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Previous step"
              >
                <Ionicons name="chevron-back" size={20} color={tooltipTextColor} />
              </Pressable>
            )}

            <Pressable
              onPress={nextStep}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={isLastStep ? 'Finish tour' : 'Next step'}
            >
              <Text style={[styles.primaryButtonText, { color: colors.black }]}>
                {isLastStep ? 'Done' : 'Next'}
              </Text>
              {!isLastStep && (
                <Ionicons name="chevron-forward" size={18} color={colors.black} />
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  spotlight: {
    position: 'absolute',
    borderRadius: SPOTLIGHT_BORDER_RADIUS,
    overflow: 'hidden',
  },
  spotlightInner: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 3,
    // Note: highlight color is applied dynamically via style prop
    borderRadius: SPOTLIGHT_BORDER_RADIUS - 2,
    // Note: shadowColor is applied dynamically via style prop
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  tooltip: {
    position: 'absolute',
    borderRadius: 20,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  tooltipArrow: {
    position: 'absolute',
    width: 20,
    height: 20,
    transform: [{ rotate: '45deg' }],
  },
  arrowUp: {
    top: -10,
  },
  arrowDown: {
    bottom: -10,
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  tooltipBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    gap: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
