import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import {
  adminGetMechanicDetail,
  AdminMechanicDetail,
  adminSetVerificationStatus,
  adminSetMechanicTier,
  formatDateTime,
  formatCents
} from '../../../src/lib/admin';

const TIERS = ['probation', 'standard', 'trusted'];

const TIER_COLORS: Record<string, string> = {
  probation: '#F59E0B',
  standard: '#3B82F6',
  trusted: '#10B981',
};

const STATUS_COLORS: Record<string, string> = {
  pending_verification: '#F59E0B',
  active: '#10B981',
  paused: '#6B7280',
  removed: '#EF4444',
};

export default function AdminMechanicDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminMechanicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await adminGetMechanicDetail(id);
      setDetail(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

  const handleSetStatus = async (status: string, reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await adminSetVerificationStatus(id, status, reason);
      fetchDetail();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetTier = async (tier: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await adminSetMechanicTier(id, tier);
      fetchDetail();
    } catch (error) {
      Alert.alert('Error', 'Failed to update tier');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Mechanic not found</Text>
      </View>
    );
  }

  const { mechanic, documents, vetting, jobs, reviews, disputes, support_requests } = detail;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | boolean | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>
        {value === true ? 'Yes' : value === false ? 'No' : (value?.toString() || '-')}
      </Text>
    </View>
  );

  const ActionButton = ({ label, color, onPress }: { label: string; color: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={actionLoading}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: color,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
        opacity: actionLoading ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{mechanic.full_name || 'Unknown'}</Text>
          <Text style={{ fontSize: 12, color: STATUS_COLORS[mechanic.verification_status] || colors.textSecondary }}>
            {(mechanic.verification_status || '').toUpperCase().replace('_', ' ')}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Profile">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Email" value={mechanic.email} />
            <InfoRow label="Phone" value={mechanic.phone} />
            <InfoRow label="Location" value={mechanic.city && mechanic.state ? `${mechanic.city}, ${mechanic.state}` : null} />
            <InfoRow label="Hub" value={mechanic.hub_name} />
            <InfoRow label="Tier" value={mechanic.tier} />
            <InfoRow label="Rating" value={mechanic.rating_avg ? `${Number(mechanic.rating_avg).toFixed(1)} (${mechanic.rating_count})` : null} />
            <InfoRow label="Jobs Completed" value={mechanic.jobs_completed} />
            <InfoRow label="Experience" value={mechanic.years_experience ? `${mechanic.years_experience} years` : null} />
            <InfoRow label="Hourly Rate" value={mechanic.hourly_rate_cents ? formatCents(mechanic.hourly_rate_cents) : null} />
            <InfoRow label="Service Radius" value={mechanic.service_radius_km ? `${mechanic.service_radius_km} km` : null} />
            <InfoRow label="Mobile Service" value={mechanic.mobile_service} />
            <InfoRow label="Available" value={mechanic.is_available} />
            <InfoRow label="Stripe Connected" value={mechanic.stripe_onboarding_complete} />
            <InfoRow label="Joined" value={formatDateTime(mechanic.created_at)} />
            {mechanic.verification_reason && <InfoRow label="Verification Reason" value={mechanic.verification_reason} />}
          </View>
          {mechanic.bio && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Bio</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{mechanic.bio}</Text>
            </View>
          )}
        </Section>

        <Section title="Actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {mechanic.verification_status === 'pending_verification' && (
              <>
                <ActionButton label="Activate" color="#10B981" onPress={() => handleSetStatus('active')} />
                <ActionButton label="Remove" color="#EF4444" onPress={() => {
                  Alert.prompt('Removal Reason', 'Enter reason:', (reason) => {
                    if (reason) handleSetStatus('removed', reason);
                  });
                }} />
              </>
            )}
            {mechanic.verification_status === 'active' && (
              <ActionButton label="Pause" color="#6B7280" onPress={() => handleSetStatus('paused')} />
            )}
            {mechanic.verification_status === 'paused' && (
              <ActionButton label="Reactivate" color="#10B981" onPress={() => handleSetStatus('active')} />
            )}
            {mechanic.verification_status === 'removed' && (
              <ActionButton label="Reactivate" color="#10B981" onPress={() => handleSetStatus('active')} />
            )}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>Set Tier</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TIERS.map(tier => (
              <ActionButton
                key={tier}
                label={tier.charAt(0).toUpperCase() + tier.slice(1)}
                color={mechanic.tier === tier ? TIER_COLORS[tier] : colors.border}
                onPress={() => handleSetTier(tier)}
              />
            ))}
          </View>
        </Section>

        <Section title={`Documents (${documents?.length || 0})`}>
          {!documents || documents.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No documents uploaded</Text>
          ) : (
            documents.map(doc => (
              <View key={doc.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{doc.doc_type || 'Document'}</Text>
                  <Text style={{ color: doc.status === 'approved' ? '#10B981' : doc.status === 'rejected' ? '#EF4444' : '#F59E0B', fontSize: 12 }}>{doc.status || 'pending'}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Uploaded {formatDateTime(doc.uploaded_at)}</Text>
                {doc.review_notes && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Notes: {doc.review_notes}</Text>
                )}
              </View>
            ))
          )}
        </Section>

        {vetting && vetting.length > 0 && (
          <Section title={`Vetting Responses (${vetting.length})`}>
            {vetting.map(v => (
              <View key={v.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>{v.prompt_text}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{v.response_text}</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title={`Recent Jobs (${jobs?.length || 0})`}>
          {!jobs || jobs.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No jobs yet</Text>
          ) : (
            jobs.map(job => (
              <TouchableOpacity 
                key={job.id} 
                onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
                style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <Text style={{ fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>{job.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{job.customer_name} - {job.status}</Text>
              </TouchableOpacity>
            ))
          )}
        </Section>

        {reviews && reviews.length > 0 && (
          <Section title={`Reviews (${reviews.length})`}>
            {reviews.map(review => (
              <View key={review.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Ionicons key={star} name={star <= review.overall_rating ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
                  ))}
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}>{review.reviewer_name}</Text>
                </View>
                {review.comment && (
                  <Text style={{ fontSize: 13, color: colors.textPrimary }}>{review.comment}</Text>
                )}
              </View>
            ))}
          </Section>
        )}

        {disputes && disputes.length > 0 && (
          <Section title={`Disputes (${disputes.length})`}>
            {disputes.map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push(`/(admin)/disputes/${d.id}`)}
                style={{ backgroundColor: '#EF444410', borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: '#EF4444' }}>{d.category}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{d.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {support_requests && support_requests.length > 0 && (
          <Section title={`Support Requests (${support_requests.length})`}>
            {support_requests.map(sr => (
              <TouchableOpacity
                key={sr.id}
                onPress={() => router.push(`/(admin)/support/${sr.id}`)}
                style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <Text style={{ fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>{sr.message}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{sr.category} - {sr.status}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}