import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetMechanicDetail, formatDateTime, formatCents } from '../../../src/lib/admin';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#3B82F6',
  pending: '#F59E0B',
  cancelled: '#EF4444',
};

interface MechanicDetail {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    hub_id: string | null;
    created_at: string;
    mechanic_profiles: Array<{
      bio: string | null;
      years_experience: number | null;
      hourly_rate_cents: number | null;
      rating_avg: number | null;
      rating_count: number;
      jobs_completed: number;
      is_available: boolean;
      stripe_onboarding_complete: boolean;
      verification_status: string | null;
    }>;
  };
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    final_price_cents: number | null;
  }>;
  reviews: Array<{
    id: string;
    overall_rating: number;
    comment: string | null;
    created_at: string;
  }>;
}

export default function AdminMechanicDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<MechanicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageModalVisible, setMessageModalVisible] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await adminGetMechanicDetail(id);
      setDetail(data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err?.message || 'Failed to load mechanic');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

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
        <Text style={{ color: colors.textSecondary }}>{error || 'Mechanic not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = detail.profile;
  const mp = Array.isArray(profile.mechanic_profiles) ? profile.mechanic_profiles[0] : profile.mechanic_profiles;

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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{profile.full_name || 'Unknown'}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Mechanic</Text>
        </View>
        <TouchableOpacity
          onPress={() => setMessageModalVisible(true)}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 6 }}>Message</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Profile">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Location" value={profile.city && profile.state ? `${profile.city}, ${profile.state}` : null} />
            <InfoRow label="Rating" value={mp?.rating_avg ? `${Number(mp.rating_avg).toFixed(1)} (${mp.rating_count})` : null} />
            <InfoRow label="Jobs Completed" value={mp?.jobs_completed} />
            <InfoRow label="Experience" value={mp?.years_experience ? `${mp.years_experience} years` : null} />
            <InfoRow label="Hourly Rate" value={mp?.hourly_rate_cents ? formatCents(mp.hourly_rate_cents) : null} />
            <InfoRow label="Available" value={mp?.is_available} />
            <InfoRow label="Stripe Connected" value={mp?.stripe_onboarding_complete} />
            <InfoRow label="Joined" value={formatDateTime(profile.created_at)} />
          </View>
          {mp?.bio && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Bio</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{mp.bio}</Text>
            </View>
          )}
        </Section>

        <Section title={`Jobs (${detail.jobs.length})`}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            {detail.jobs.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>No jobs yet</Text>
            ) : (
              detail.jobs.slice(0, 10).map((job, i) => (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < Math.min(detail.jobs.length, 10) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{job.title}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(job.created_at)}</Text>
                      {job.final_price_cents && (
                        <Text style={{ fontSize: 12, color: colors.accent }}>{formatCents(job.final_price_cents)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: (STATUS_COLORS[job.status] || colors.textSecondary) + '20',
                  }}>
                    <Text style={{ fontSize: 11, color: STATUS_COLORS[job.status] || colors.textSecondary, fontWeight: '600' }}>
                      {job.status.toUpperCase().replace(/_/g, ' ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Section>

        {detail.reviews.length > 0 && (
          <Section title={`Reviews (${detail.reviews.length})`}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              {detail.reviews.slice(0, 5).map((review, i) => (
                <View
                  key={review.id}
                  style={{
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < Math.min(detail.reviews.length, 5) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons
                          key={star}
                          name={star <= review.overall_rating ? 'star' : 'star-outline'}
                          size={14}
                          color={colors.warning}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(review.created_at)}</Text>
                  </View>
                  {review.comment && (
                    <Text style={{ fontSize: 14, color: colors.textPrimary, marginTop: 4 }}>{review.comment}</Text>
                  )}
                </View>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>

      <AdminMessageModal
        visible={messageModalVisible}
        onClose={() => setMessageModalVisible(false)}
        recipient={{
          id: profile.id,
          name: profile.full_name || profile.email || 'Mechanic',
          role: 'Mechanic',
        }}
        relatedJobId={detail.jobs[0]?.id}
        relatedJobTitle={detail.jobs[0]?.title}
      />
    </View>
  );
}