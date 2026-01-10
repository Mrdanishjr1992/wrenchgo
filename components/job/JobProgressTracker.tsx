import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../src/ui/theme-context';
import type { JobProgress } from '../../src/types/job-lifecycle';

interface ProgressStep {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
  active: boolean;
  timestamp?: string;
}

interface JobProgressTrackerProps {
  progress: JobProgress | null;
  status: string;
  role: 'customer' | 'mechanic';
}

function AnimatedStep({
  step,
  index,
  isLast,
  colors
}: {
  step: ProgressStep;
  index: number;
  isLast: boolean;
  colors: any;
}) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  const glowOpacity = useSharedValue(0);
  const lineProgress = useSharedValue(step.completed ? 1 : 0);

  useEffect(() => {
    if (step.active) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(0.2, { duration: 1000 })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        false
      );
    }

    if (step.completed) {
      lineProgress.value = withDelay(index * 100, withTiming(1, { duration: 500 }));
    }
  }, [step.active, step.completed]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    height: `${interpolate(lineProgress.value, [0, 1], [0, 100])}%`,
  }));

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndicatorColumn}>
        <View style={styles.circleContainer}>
          {step.active && (
            <Animated.View
              style={[
                styles.pulseRing,
                { backgroundColor: colors.accent },
                pulseStyle,
              ]}
            />
          )}

          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: step.completed
                  ? colors.accent
                  : step.active
                  ? colors.bg
                  : colors.surface,
                borderColor: step.completed || step.active ? colors.accent : colors.border,
                borderWidth: step.active ? 3 : 2,
              },
            ]}
          >
            {step.completed ? (
              <Ionicons name="checkmark" size={16} color="#000" />
            ) : (
              <Ionicons
                name={step.icon}
                size={14}
                color={step.active ? colors.accent : colors.textMuted}
              />
            )}
          </View>

          {step.active && (
            <Animated.View
              style={[
                styles.glowEffect,
                { backgroundColor: colors.accent },
                glowStyle,
              ]}
            />
          )}
        </View>

        {!isLast && (
          <View style={[styles.lineContainer, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.lineProgress,
                { backgroundColor: colors.accent },
                lineStyle,
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Text
            style={[
              styles.stepLabel,
              {
                color: step.completed || step.active ? colors.textPrimary : colors.textMuted,
                fontWeight: step.active ? '800' : step.completed ? '700' : '500',
              },
            ]}
          >
            {step.label}
          </Text>
          {step.active && (
            <View style={[styles.liveBadge, { backgroundColor: colors.accent }]}>
              <View style={[styles.liveDot, { backgroundColor: '#000' }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.stepDescription,
            { color: colors.textMuted },
          ]}
        >
          {step.description}
        </Text>

        {step.timestamp && step.completed && (
          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.stepTime, { color: colors.textMuted }]}>
              {formatTime(step.timestamp)}
            </Text>
          </View>
        )}

        {step.active && (
          <View style={[styles.activeHint, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="hourglass-outline" size={14} color={colors.accent} />
            <Text style={[styles.activeHintText, { color: colors.accent }]}>
              In progress...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function JobProgressTracker({ progress, status, role }: JobProgressTrackerProps) {
  const { colors } = useTheme();

  const getSteps = (): ProgressStep[] => {
    const steps: ProgressStep[] = [
      {
        key: 'accepted',
        label: 'Quote Accepted',
        description: 'Job has been confirmed and scheduled',
        icon: 'checkmark-circle',
        completed: true,
        active: false,
        timestamp: progress?.created_at,
      },
      {
        key: 'departed',
        label: 'Mechanic En Route',
        description: role === 'customer' ? 'Your mechanic is on the way' : 'Heading to customer location',
        icon: 'car',
        completed: !!progress?.mechanic_departed_at,
        active: !!progress?.mechanic_departed_at && !progress?.mechanic_arrived_at,
        timestamp: progress?.mechanic_departed_at ?? undefined,
      },
      {
        key: 'arrived',
        label: 'Arrived at Location',
        description: role === 'customer' ? 'Mechanic has arrived' : 'You have arrived',
        icon: 'location',
        completed: !!progress?.mechanic_arrived_at,
        active: !!progress?.mechanic_arrived_at && !progress?.customer_confirmed_arrival_at,
        timestamp: progress?.mechanic_arrived_at ?? undefined,
      },
      {
        key: 'confirmed',
        label: role === 'customer' ? 'Arrival Confirmed' : 'Customer Confirmed',
        description: role === 'customer' ? 'You confirmed the mechanic arrived' : 'Customer confirmed your arrival',
        icon: 'person-circle',
        completed: !!progress?.customer_confirmed_arrival_at,
        active: !!progress?.customer_confirmed_arrival_at && !progress?.work_started_at,
        timestamp: progress?.customer_confirmed_arrival_at ?? undefined,
      },
      {
        key: 'work_started',
        label: 'Work In Progress',
        description: 'Repair work is underway',
        icon: 'construct',
        completed: !!progress?.work_started_at,
        active: !!progress?.work_started_at && !progress?.finalized_at,
        timestamp: progress?.work_started_at ?? undefined,
      },
      {
        key: 'completed',
        label: 'Job Completed',
        description: 'All work has been finished',
        icon: 'trophy',
        completed: !!progress?.finalized_at,
        active: false,
        timestamp: progress?.finalized_at ?? undefined,
      },
    ];

    return steps;
  };

  const steps = getSteps();
  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (status === 'cancelled' || status === 'canceled') {
    return (
      <View style={[styles.statusContainer, { backgroundColor: '#FEE2E2' }]}>
        <View style={[styles.statusIconCircle, { backgroundColor: '#EF4444' }]}>
          <Ionicons name="close" size={24} color="#fff" />
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={[styles.statusTitle, { color: '#991B1B' }]}>Job Cancelled</Text>
          <Text style={[styles.statusSubtitle, { color: '#B91C1C' }]}>This job has been cancelled</Text>
        </View>
      </View>
    );
  }

  if (status === 'disputed') {
    return (
      <View style={[styles.statusContainer, { backgroundColor: '#FEF3C7' }]}>
        <View style={[styles.statusIconCircle, { backgroundColor: '#F59E0B' }]}>
          <Ionicons name="warning" size={24} color="#fff" />
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={[styles.statusTitle, { color: '#92400E' }]}>Under Dispute</Text>
          <Text style={[styles.statusSubtitle, { color: '#B45309' }]}>This job is being reviewed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.progressHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Overall Progress</Text>
          <Text style={[styles.progressPercent, { color: colors.accent }]}>{progressPercent}%</Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: colors.accent,
                width: `${progressPercent}%`,
              }
            ]}
          />
        </View>
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <AnimatedStep
            key={step.key}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  progressHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepsContainer: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 80,
  },
  stepIndicatorColumn: {
    width: 40,
    alignItems: 'center',
  },
  circleContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  glowEffect: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.2,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  lineContainer: {
    flex: 1,
    width: 3,
    borderRadius: 1.5,
    marginVertical: 4,
    overflow: 'hidden',
  },
  lineProgress: {
    width: '100%',
    borderRadius: 1.5,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 15,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  stepTime: {
    fontSize: 12,
  },
  activeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activeHintText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  statusIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default JobProgressTracker;
