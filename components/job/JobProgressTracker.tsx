import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { JobProgress } from '../../src/types/job-lifecycle';
import { getJobPhase } from '../../src/types/job-lifecycle';

interface ProgressStep {
  key: string;
  label: string;
  icon: string;
  completed: boolean;
  active: boolean;
  timestamp?: string;
}

interface JobProgressTrackerProps {
  progress: JobProgress | null;
  status: string;
  role: 'customer' | 'mechanic';
}

export function JobProgressTracker({ progress, status, role }: JobProgressTrackerProps) {
  const { colors } = useTheme();

  const getSteps = (): ProgressStep[] => {
    const steps: ProgressStep[] = [
      {
        key: 'accepted',
        label: 'Quote Accepted',
        icon: 'checkmark-circle',
        completed: true,
        active: false,
        timestamp: progress?.created_at,
      },
      {
        key: 'departed',
        label: 'Mechanic En Route',
        icon: 'car',
        completed: !!progress?.mechanic_departed_at,
        active: !!progress?.mechanic_departed_at && !progress?.mechanic_arrived_at,
        timestamp: progress?.mechanic_departed_at ?? undefined,
      },
      {
        key: 'arrived',
        label: 'Arrived',
        icon: 'location',
        completed: !!progress?.mechanic_arrived_at,
        active: !!progress?.mechanic_arrived_at && !progress?.customer_confirmed_arrival_at,
        timestamp: progress?.mechanic_arrived_at ?? undefined,
      },
      {
        key: 'confirmed',
        label: role === 'customer' ? 'You Confirmed Arrival' : 'Customer Confirmed',
        icon: 'person-circle',
        completed: !!progress?.customer_confirmed_arrival_at,
        active: !!progress?.customer_confirmed_arrival_at && !progress?.work_started_at,
        timestamp: progress?.customer_confirmed_arrival_at ?? undefined,
      },
      {
        key: 'work_started',
        label: 'Work In Progress',
        icon: 'construct',
        completed: !!progress?.work_started_at,
        active: !!progress?.work_started_at && !progress?.finalized_at,
        timestamp: progress?.work_started_at ?? undefined,
      },
      {
        key: 'completed',
        label: 'Completed',
        icon: 'trophy',
        completed: !!progress?.finalized_at,
        active: false,
        timestamp: progress?.finalized_at ?? undefined,
      },
    ];

    return steps;
  };

  const steps = getSteps();
  const currentPhase = getJobPhase(progress, null);

  // Handle cancelled/disputed status
  if (status === 'cancelled') {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cancelledHeader}>
          <Ionicons name="close-circle" size={24} color="#EF4444" />
          <Text style={[styles.cancelledText, { color: '#EF4444' }]}>Job Cancelled</Text>
        </View>
      </View>
    );
  }

  if (status === 'disputed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cancelledHeader}>
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <Text style={[styles.cancelledText, { color: '#F59E0B' }]}>Under Dispute</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.stepWrapper}>
            {/* Connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: step.completed ? colors.accent : colors.border,
                  },
                ]}
              />
            )}

            {/* Step circle */}
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor: step.completed
                    ? colors.accent
                    : step.active
                    ? `${colors.accent}30`
                    : colors.surface,
                  borderColor: step.completed || step.active ? colors.accent : colors.border,
                },
              ]}
            >
              {step.completed ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Ionicons
                  name={step.icon as any}
                  size={12}
                  color={step.active ? colors.accent : colors.textMuted}
                />
              )}
            </View>

            {/* Step label */}
            <Text
              style={[
                styles.stepLabel,
                {
                  color: step.completed || step.active ? colors.textPrimary : colors.textMuted,
                  fontWeight: step.active ? '700' : '500',
                },
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>

            {/* Timestamp */}
            {step.timestamp && step.completed && (
              <Text style={[styles.stepTime, { color: colors.textMuted }]}>
                {formatTime(step.timestamp)}
              </Text>
            )}

            {/* Active indicator */}
            {step.active && (
              <View style={[styles.activePulse, { backgroundColor: `${colors.accent}30` }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cancelledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelledText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 12,
    left: -50,
    right: 50,
    height: 2,
    zIndex: -1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 2,
    lineHeight: 14,
  },
  stepTime: {
    fontSize: 9,
    marginTop: 2,
  },
  activePulse: {
    position: 'absolute',
    top: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: -1,
  },
});

export default JobProgressTracker;
