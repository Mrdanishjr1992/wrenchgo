import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { JobProgress, JobContract } from '../../src/types/job-lifecycle';
import { getJobPhase, canCustomerCancel, formatCents } from '../../src/types/job-lifecycle';
import {
  mechanicMarkDeparted,
  mechanicMarkArrived,
  mechanicStartWork,
  mechanicMarkComplete,
  customerConfirmArrival,
  customerConfirmComplete,
  cancelJob,
} from '../../src/lib/job-contract';

interface JobActionsProps {
  jobId: string;
  progress: JobProgress | null;
  contract: JobContract | null;
  role: 'customer' | 'mechanic';
  onRefresh?: () => void;
  hasPendingItems?: boolean;
}

export function JobActions({
  jobId,
  progress,
  contract,
  role,
  onRefresh,
  hasPendingItems = false,
}: JobActionsProps) {
  const { colors, spacing } = useTheme();
  const [loading, setLoading] = useState(false);

  const phase = getJobPhase(progress, contract);

  const handleAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage?: string
  ) => {
    setLoading(true);
    try {
      const result = await action();
      if (!result.success) {
        Alert.alert('Error', result.error || 'Action failed');
      } else {
        if (successMessage) {
          Alert.alert('Success', successMessage);
        }
        onRefresh?.();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const cancelInfo = canCustomerCancel(progress);
    
    if (!cancelInfo.allowed) {
      Alert.alert('Cannot Cancel', 'Work has already started. Please contact support if you have issues.');
      return;
    }

    const feeMessage = cancelInfo.fee > 0
      ? `\n\nA travel fee of ${formatCents(cancelInfo.fee)} will apply.`
      : '\n\nYou will receive a full refund.';

    Alert.alert(
      'Cancel Job?',
      `Are you sure you want to cancel this job?${feeMessage}`,
      [
        { text: 'Keep Job', style: 'cancel' },
        {
          text: 'Cancel Job',
          style: 'destructive',
          onPress: () => {
            handleAction(
              () => cancelJob(jobId, cancelInfo.reason!, 'Cancelled by user'),
              'Job has been cancelled'
            );
          },
        },
      ]
    );
  };

  // CUSTOMER ACTIONS
  if (role === 'customer') {
    return (
      <View style={styles.container}>
        {/* Confirm Arrival */}
        {phase === 'awaiting_arrival_confirmation' && (
          <View style={styles.actionCard}>
            <View style={[styles.actionHeader, { backgroundColor: `${colors.accent}15` }]}>
              <Ionicons name="location" size={24} color={colors.accent} />
              <Text style={[styles.actionTitle, { color: colors.accent }]}>
                Mechanic Has Arrived
              </Text>
            </View>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Please confirm the mechanic has arrived at your location. Work cannot begin until you confirm.
            </Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={() => handleAction(
                () => customerConfirmArrival(jobId),
                'Arrival confirmed!'
              )}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Confirm Arrival</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Confirm Completion */}
        {phase === 'awaiting_completion' && progress?.mechanic_completed_at && !progress?.customer_completed_at && (
          <View style={styles.actionCard}>
            <View style={[styles.actionHeader, { backgroundColor: colors.successBg }]}>
              <Ionicons name="checkmark-done" size={24} color={colors.success} />
              <Text style={[styles.actionTitle, { color: colors.success }]}>
                Work Complete
              </Text>
            </View>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              The mechanic has marked the work as complete. Please review and confirm if you're satisfied.
            </Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.success }]}
              onPress={() => {
                Alert.alert(
                  'Confirm Completion?',
                  'By confirming, you agree the work has been completed satisfactorily. Payment will be released to the mechanic.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm & Pay',
                      onPress: () => handleAction(
                        () => customerConfirmComplete(jobId),
                        'Job completed! Thank you for using WrenchGo.'
                      ),
                    },
                  ]
                );
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Confirm & Complete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Waiting for mechanic to complete */}
        {phase === 'awaiting_completion' && progress?.customer_completed_at && !progress?.mechanic_completed_at && (
          <View style={[styles.statusCard, { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}>
            <Ionicons name="hourglass" size={20} color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.accent }]}>
              Waiting for mechanic to confirm completion
            </Text>
          </View>
        )}

        {/* Cancel option for early phases */}
        {['quote_accepted', 'mechanic_en_route', 'awaiting_arrival_confirmation'].includes(phase) && (
          <Pressable
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel Job</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // MECHANIC ACTIONS
  return (
    <View style={styles.container}>
      {/* Mark Departed */}
      {phase === 'quote_accepted' && (
        <View style={styles.actionCard}>
          <View style={[styles.actionHeader, { backgroundColor: `${colors.accent}15` }]}>
            <Ionicons name="car" size={24} color={colors.accent} />
            <Text style={[styles.actionTitle, { color: colors.accent }]}>
              Ready to Go?
            </Text>
          </View>
          <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
            Let the customer know you're on your way.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => handleAction(
              () => mechanicMarkDeparted(jobId),
              'Customer notified!'
            )}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>I'm On My Way</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Mark Arrived */}
      {phase === 'mechanic_en_route' && (
        <View style={styles.actionCard}>
          <View style={[styles.actionHeader, { backgroundColor: `${colors.accent}15` }]}>
            <Ionicons name="location" size={24} color={colors.accent} />
            <Text style={[styles.actionTitle, { color: colors.accent }]}>
              Arrived?
            </Text>
          </View>
          <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
            Mark your arrival when you reach the customer's location.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => handleAction(
              () => mechanicMarkArrived(jobId),
              'Arrival marked! Waiting for customer confirmation.'
            )}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>I've Arrived</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Waiting for arrival confirmation */}
      {phase === 'awaiting_arrival_confirmation' && (
        <View style={[styles.statusCard, { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}>
          <Ionicons name="hourglass" size={20} color={colors.accent} />
          <Text style={[styles.statusText, { color: colors.accent }]}>
            Waiting for customer to confirm your arrival
          </Text>
        </View>
      )}

      {/* Start Work */}
      {phase === 'ready_to_start' && (
        <View style={styles.actionCard}>
          <View style={[styles.actionHeader, { backgroundColor: colors.successBg }]}>
            <Ionicons name="construct" size={24} color={colors.success} />
            <Text style={[styles.actionTitle, { color: colors.success }]}>
              Ready to Start?
            </Text>
          </View>
          <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
            Customer has confirmed your arrival. Start the work timer.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.success }]}
            onPress={() => handleAction(
              () => mechanicStartWork(jobId),
              'Work started! You can now add line items.'
            )}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Start Work</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Mark Complete */}
      {phase === 'work_in_progress' && (
        <View style={styles.actionCard}>
          <View style={[styles.actionHeader, { backgroundColor: colors.infoBg }]}>
            <Ionicons name="checkmark-done" size={24} color={colors.info} />
            <Text style={[styles.actionTitle, { color: colors.info }]}>
              Finished?
            </Text>
          </View>
          {hasPendingItems ? (
            <Text style={[styles.actionDescription, { color: colors.error }]}>
              There are pending line items awaiting customer approval. Please wait for approval before completing.
            </Text>
          ) : (
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Mark the job as complete when you're done.
            </Text>
          )}
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: hasPendingItems ? colors.textMuted : colors.info },
            ]}
            onPress={() => handleAction(
              () => mechanicMarkComplete(jobId),
              'Marked complete! Waiting for customer confirmation.'
            )}
            disabled={loading || hasPendingItems}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Mark Complete</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Waiting for customer completion */}
      {phase === 'awaiting_completion' && progress?.mechanic_completed_at && !progress?.customer_completed_at && (
        <View style={[styles.statusCard, { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}>
          <Ionicons name="hourglass" size={20} color={colors.accent} />
          <Text style={[styles.statusText, { color: colors.accent }]}>
            Waiting for customer to confirm completion
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionDescription: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default JobActions;
