import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
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
  FadeIn,
  FadeInDown,
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

function AnimatedStep({
  step,
  index,
  isLast,
}: {
  step: ProgressStep;
  index: number;
  isLast: boolean;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
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

  const stepColor = step.completed ? colors.success : step.active ? colors.primary : colors.textMuted;

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 80).duration(300)}
      style={{
        flexDirection: 'row',
        minHeight: 90,
      }}
    >
      <View style={{
        width: 48,
        alignItems: 'center',
      }}>
        <View style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {step.active && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                },
                pulseStyle,
              ]}
            />
          )}

          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: step.completed
                ? colors.success
                : step.active
                ? colors.bg
                : colors.surface,
              borderWidth: step.active ? 3 : 2,
              borderColor: step.completed ? colors.success : step.active ? colors.primary : colors.border,
              zIndex: 1,
            }}
          >
            {step.completed ? (
              <Ionicons name="checkmark" size={18} color={colors.white} />
            ) : (
              <Ionicons
                name={step.icon}
                size={16}
                color={step.active ? colors.primary : colors.textMuted}
              />
            )}
          </View>

          {step.active && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.primary,
                  opacity: 0.15,
                },
                glowStyle,
              ]}
            />
          )}
        </View>

        {!isLast && (
          <View style={{
            flex: 1,
            width: 3,
            borderRadius: 1.5,
            marginVertical: 4,
            backgroundColor: colors.border,
            overflow: 'hidden',
          }}>
            <Animated.View
              style={[
                {
                  width: '100%',
                  borderRadius: 1.5,
                  backgroundColor: colors.success,
                },
                lineStyle,
              ]}
            />
          </View>
        )}
      </View>

      <View style={{
        flex: 1,
        paddingLeft: spacing.sm,
        paddingBottom: spacing.lg,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: 4,
        }}>
          <Text style={{
            fontSize: 15,
            fontWeight: step.active ? '700' : step.completed ? '600' : '500',
            color: step.completed || step.active ? colors.textPrimary : colors.textMuted,
          }}>
            {step.label}
          </Text>
          {step.active && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.primary,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.full,
            }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.white,
              }} />
              <Text style={{
                fontSize: 10,
                fontWeight: '800',
                color: colors.white,
              }}>LIVE</Text>
            </View>
          )}
        </View>

        <Text style={{
          fontSize: 13,
          lineHeight: 18,
          color: colors.textMuted,
        }}>
          {step.description}
        </Text>

        {step.timestamp && step.completed && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.xs,
          }}>
            <Ionicons name="time-outline" size={12} color={colors.success} />
            <Text style={{
              fontSize: 12,
              color: colors.success,
              fontWeight: '500',
            }}>
              {formatTime(step.timestamp)}
            </Text>
          </View>
        )}

        {step.active && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            backgroundColor: withAlpha(colors.primary, 0.1),
            alignSelf: 'flex-start',
          }}>
            <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.primary,
            }}>
              In progress...
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function StatusBanner({
  type,
  title,
  subtitle,
}: {
  type: 'cancelled' | 'disputed';
  title: string;
  subtitle: string;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const config = type === 'cancelled'
    ? { bg: colors.errorBg, color: colors.error, icon: 'close-circle' as const }
    : { bg: colors.warningBg, color: colors.warning, icon: 'warning' as const };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: config.bg,
        borderRadius: radius.xl,
        ...shadows.sm,
      }}
    >
      <View style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: config.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={config.icon} size={28} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 17,
          fontWeight: '700',
          color: config.color,
          marginBottom: 2,
        }}>{title}</Text>
        <Text style={{
          fontSize: 14,
          color: withAlpha(config.color, 0.8),
        }}>{subtitle}</Text>
      </View>
    </Animated.View>
  );
}

export function JobProgressTracker({ progress, status, role }: JobProgressTrackerProps) {
  const { colors, spacing, radius, withAlpha } = useTheme();

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
        completed: !!progress?.work_started_at && !!progress?.mechanic_completed_at,
        active: !!progress?.work_started_at && !progress?.mechanic_completed_at,
        timestamp: progress?.work_started_at ?? undefined,
      },
      {
        key: 'completed',
        label: 'Job Completed',
        description: progress?.finalized_at
          ? 'All work has been finished'
          : progress?.mechanic_completed_at
            ? (role === 'customer' ? 'Mechanic marked complete - please confirm' : 'Waiting for customer confirmation')
            : 'All work has been finished',
        icon: 'trophy',
        completed: !!progress?.finalized_at,
        active: !!progress?.mechanic_completed_at && !progress?.finalized_at,
        timestamp: progress?.finalized_at ?? progress?.mechanic_completed_at ?? undefined,
      },
    ];

    return steps;
  };

  const steps = getSteps();
  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (status === 'cancelled' || status === 'canceled') {
    return (
      <StatusBanner
        type="cancelled"
        title="Job Cancelled"
        subtitle="This job has been cancelled"
      />
    );
  }

  if (status === 'disputed') {
    return (
      <StatusBanner
        type="disputed"
        title="Under Dispute"
        subtitle="This job is being reviewed"
      />
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Animated.View 
        entering={FadeIn.duration(300)}
        style={{
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>Overall Progress</Text>
          <View style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 2,
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '800',
              color: colors.primary,
            }}>{progressPercent}</Text>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.textMuted,
            }}>%</Text>
          </View>
        </View>
        <View style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: withAlpha(colors.primary, 0.15),
          overflow: 'hidden',
        }}>
          <Animated.View
            style={{
              height: '100%',
              borderRadius: 4,
              backgroundColor: colors.primary,
              width: `${progressPercent}%`,
            }}
          />
        </View>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.xs,
        }}>
          <Text style={{
            fontSize: 12,
            color: colors.textMuted,
          }}>{completedCount} of {steps.length} steps</Text>
          <Text style={{
            fontSize: 12,
            color: colors.success,
            fontWeight: '500',
          }}>{completedCount === steps.length ? 'Complete!' : `${steps.length - completedCount} remaining`}</Text>
        </View>
      </Animated.View>

      <View>
        {steps.map((step, index) => (
          <AnimatedStep
            key={step.key}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
          />
        ))}
      </View>
    </View>
  );
}
