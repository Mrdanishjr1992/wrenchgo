import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetDisputeDetail, formatDateTime } from '../../../src/lib/admin';
import { adminResolveDispute } from '../../../src/lib/disputes';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  under_review: '#3B82F6',
  evidence_requested: '#8B5CF6',
  resolved_customer: '#10B981',
  resolved_mechanic: '#10B981',
  resolved_split: '#10B981',
  closed: '#6B7280',
};

interface DisputeDetail {
  dispute: {
    id: string;
    job_id: string;
    contract_id: string | null;
    filed_by: string;
    filed_by_role: string;
    filed_against: string;
    status: string;
    category: string;
    description: string;
    desired_resolution: string | null;
    evidence_urls: string[] | null;
    resolved_at: string | null;
    resolved_by: string | null;
    resolution_type: string | null;
    resolution_notes: string | null;
    customer_refund_cents: number | null;
    mechanic_adjustment_cents: number | null;
    internal_notes: string | null;
    assigned_to: string | null;
    priority: string | null;
    response_deadline: string | null;
    evidence_deadline: string | null;
    created_at: string;
    updated_at: string;
  };
  job: {
    id: string;
    title: string;
    status: string;
    customer_id: string;
    accepted_mechanic_id: string | null;
  } | null;
}

export default function AdminDisputeDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<'filer' | 'defendant' | null>(null);

  const resolutionOptions = useMemo(
    () => [
      { value: 'resolved_customer', label: 'Refund customer' },
      { value: 'resolved_mechanic', label: 'Pay mechanic' },
      { value: 'resolved_split', label: 'Split adjustment' },
      { value: 'closed', label: 'Close (no payout)' },
    ],
    []
  );
  const [resolutionType, setResolutionType] = useState<string>('resolved_customer');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [mechanicAdjustmentAmount, setMechanicAdjustmentAmount] = useState('');
  const [resolving, setResolving] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await adminGetDisputeDetail(id);
      setDetail(d);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err?.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const parseMoneyToCents = useCallback((value: string): number | null => {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }, []);

  const handleResolve = useCallback(async () => {
    if (!detail?.dispute || detail.dispute.resolved_at) return;
    if (!resolutionType) {
      Alert.alert('Missing resolution type', 'Select a resolution type before resolving this dispute.');
      return;
    }

    try {
      setResolving(true);

      const customerRefundCents = parseMoneyToCents(refundAmount);
      const mechanicAdjustmentCents = parseMoneyToCents(mechanicAdjustmentAmount);

      const result = await adminResolveDispute({
        disputeId: detail.dispute.id,
        resolutionType,
        resolutionNotes: resolutionNotes?.trim() || null,
        customerRefundCents,
        mechanicAdjustmentCents,
      });

      if (!result?.success) {
        throw new Error(result?.message || 'Failed to resolve dispute');
      }

      Alert.alert('Dispute resolved', 'The dispute has been marked as resolved.');
      await refresh();
    } catch (err: any) {
      console.error('Resolve dispute error:', err);
      Alert.alert('Resolve failed', err?.message || 'Unable to resolve this dispute');
    } finally {
      setResolving(false);
    }
  }, [detail?.dispute, detail?.dispute?.resolved_at, mechanicAdjustmentAmount, parseMoneyToCents, refundAmount, refresh, resolutionNotes, resolutionType]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>{error || 'Dispute not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { dispute, job } = detail;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Dispute Details</Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: (STATUS_COLORS[dispute.status] || colors.textSecondary) + '20',
            alignSelf: 'flex-start',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 11, color: STATUS_COLORS[dispute.status] || colors.textSecondary, fontWeight: '600' }}>
              {dispute.status.toUpperCase().replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Dispute Info">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Category" value={dispute.category} />
            <InfoRow label="Priority" value={dispute.priority} />
            <InfoRow label="Filed By" value={dispute.filed_by_role} />
            <InfoRow label="Created" value={formatDateTime(dispute.created_at)} />
            {dispute.response_deadline && <InfoRow label="Response Deadline" value={formatDateTime(dispute.response_deadline)} />}
            {dispute.evidence_deadline && <InfoRow label="Evidence Deadline" value={formatDateTime(dispute.evidence_deadline)} />}
            {dispute.assigned_to && <InfoRow label="Assigned To" value={dispute.assigned_to} />}
          </View>
        </Section>

        <Section title="Message Parties">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setMessageTarget('filer')}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                padding: spacing.md,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 6 }}>Filer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMessageTarget('defendant')}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', marginLeft: 6 }}>Defendant</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="Description">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{dispute.description}</Text>
          </View>
        </Section>

        {dispute.desired_resolution && (
          <Section title="Desired Resolution">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{dispute.desired_resolution}</Text>
            </View>
          </Section>
        )}

        {job && (
          <Section title="Related Job">
            <TouchableOpacity
              onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{job.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{job.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </Section>
        )}

	        {dispute.resolved_at ? (
	          <Section title="Resolution">
	            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
	              <InfoRow label="Resolved At" value={formatDateTime(dispute.resolved_at)} />
	              <InfoRow label="Resolution Type" value={dispute.resolution_type} />
	              {dispute.resolution_notes && (
	                <View style={{ marginTop: spacing.sm }}>
	                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Notes</Text>
	                  <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{dispute.resolution_notes}</Text>
	                </View>
	              )}
	            </View>
	          </Section>
	        ) : (
	          <Section title="Resolve Dispute">
	            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
	              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Resolution Type</Text>
	              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
	                {resolutionOptions.map((opt) => {
	                  const selected = opt.value === resolutionType;
	                  return (
	                    <TouchableOpacity
	                      key={opt.value}
	                      onPress={() => setResolutionType(opt.value)}
	                      style={{
	                        paddingVertical: 6,
	                        paddingHorizontal: 10,
	                        borderRadius: 999,
	                        borderWidth: 1,
	                        borderColor: selected ? colors.primary : colors.border,
	                        backgroundColor: selected ? `${colors.primary}15` : 'transparent',
	                        marginRight: 8,
	                        marginBottom: 8,
	                      }}
	                    >
	                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{opt.label}</Text>
	                    </TouchableOpacity>
	                  );
	                })}
	              </View>

	              <View style={{ marginTop: spacing.md }}>
	                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Resolution Notes</Text>
	                <TextInput
	                  value={resolutionNotes}
	                  onChangeText={setResolutionNotes}
	                  placeholder="Add internal notes (optional)"
	                  placeholderTextColor={colors.textMuted}
	                  multiline
	                  style={{
	                    marginTop: 6,
	                    minHeight: 80,
	                    padding: spacing.sm,
	                    borderRadius: 8,
	                    borderWidth: 1,
	                    borderColor: colors.border,
	                    color: colors.textPrimary,
	                    backgroundColor: colors.background,
	                    textAlignVertical: 'top',
	                  }}
	                />
	              </View>

	              <View style={{ marginTop: spacing.md }}>
	                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Customer Refund (USD)</Text>
	                <TextInput
	                  value={refundAmount}
	                  onChangeText={setRefundAmount}
	                  placeholder="0.00"
	                  placeholderTextColor={colors.textMuted}
	                  keyboardType="decimal-pad"
	                  style={{
	                    marginTop: 6,
	                    padding: spacing.sm,
	                    borderRadius: 8,
	                    borderWidth: 1,
	                    borderColor: colors.border,
	                    color: colors.textPrimary,
	                    backgroundColor: colors.background,
	                  }}
	                />
	              </View>

	              <View style={{ marginTop: spacing.md }}>
	                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Mechanic Adjustment (USD)</Text>
	                <TextInput
	                  value={mechanicAdjustmentAmount}
	                  onChangeText={setMechanicAdjustmentAmount}
	                  placeholder="0.00"
	                  placeholderTextColor={colors.textMuted}
	                  keyboardType="decimal-pad"
	                  style={{
	                    marginTop: 6,
	                    padding: spacing.sm,
	                    borderRadius: 8,
	                    borderWidth: 1,
	                    borderColor: colors.border,
	                    color: colors.textPrimary,
	                    backgroundColor: colors.background,
	                  }}
	                />
	              </View>

	              <TouchableOpacity
	                onPress={handleResolveDispute}
	                disabled={resolving || !resolutionType}
	                style={{
	                  marginTop: spacing.lg,
	                  backgroundColor: colors.primary,
	                  borderRadius: 10,
	                  paddingVertical: 12,
	                  alignItems: 'center',
	                  opacity: resolving ? 0.7 : 1,
	                }}
	              >
	                {resolving ? (
	                  <ActivityIndicator color="white" />
	                ) : (
	                  <Text style={{ color: 'white', fontWeight: '700' }}>Resolve Dispute</Text>
	                )}
	              </TouchableOpacity>
	            </View>
	          </Section>
	        )}

        {dispute.internal_notes && (
          <Section title="Internal Notes">
            <View style={{ backgroundColor: '#F59E0B10', borderRadius: 8, padding: spacing.md }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{dispute.internal_notes}</Text>
            </View>
          </Section>
        )}
      </ScrollView>

      <AdminMessageModal
        visible={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        recipient={{
          id: messageTarget === 'filer' ? dispute.filed_by : dispute.filed_against,
          name: messageTarget === 'filer' ? 'Dispute Filer' : 'Defendant',
          role: messageTarget === 'filer' ? dispute.filed_by_role : (dispute.filed_by_role === 'customer' ? 'mechanic' : 'customer'),
        }}
        relatedJobId={dispute.job_id}
        relatedJobTitle={job?.title}
        disputeId={dispute.id}
      />
    </View>
  );
}