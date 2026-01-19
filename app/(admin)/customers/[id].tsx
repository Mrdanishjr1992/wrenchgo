import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetCustomerDetails, AdminCustomerDetail, formatCents, formatDateTime } from '../../../src/lib/admin';

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#3B82F6',
  pending: '#F59E0B',
  cancelled: '#EF4444',
  open: '#F59E0B',
  resolved: '#10B981',
};

export default function AdminCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await adminGetCustomerDetails(id);
      setDetail(data);
    } catch (error) {
      console.error('Error fetching customer detail:', error);
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

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Customer not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = detail.profile;

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Customer Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>{profile.full_name}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{profile.role}</Text>
          
          {profile.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <Ionicons name="mail-outline" size={18} color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.accent, marginLeft: 8 }}>{profile.email}</Text>
            </View>
          )}
          {profile.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Ionicons name="call-outline" size={18} color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.accent, marginLeft: 8 }}>{profile.phone}</Text>
            </View>
          )}
          {(profile.city || profile.state) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 8 }}>
                {[profile.city, profile.state].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.md }}>
            Member since {formatDateTime(profile.created_at)}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>
            JOBS ({detail.jobs.length})
          </Text>
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
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(job.created_at)}</Text>
                </View>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: (STATUS_COLORS[job.status] || colors.textSecondary) + '20',
                }}>
                  <Text style={{ fontSize: 11, color: STATUS_COLORS[job.status] || colors.textSecondary, fontWeight: '600' }}>
                    {job.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {detail.payments.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>
              PAYMENTS ({detail.payments.length})
            </Text>
            {detail.payments.slice(0, 10).map((payment, i) => (
              <View
                key={payment.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: i < Math.min(detail.payments.length, 10) - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ fontSize: 14, color: colors.textPrimary }}>{formatCents(payment.amount_cents)}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {payment.paid_at ? formatDateTime(payment.paid_at) : 'Pending'}
                  </Text>
                </View>
                <Text style={{ 
                  fontSize: 12, 
                  color: payment.refunded_at ? '#EF4444' : payment.status === 'paid' ? '#10B981' : colors.textSecondary,
                  fontWeight: '600',
                }}>
                  {payment.refunded_at ? 'REFUNDED' : payment.status.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {detail.support_requests.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>
              SUPPORT REQUESTS ({detail.support_requests.length})
            </Text>
            {detail.support_requests.slice(0, 5).map((sr, i) => (
              <TouchableOpacity
                key={sr.id}
                onPress={() => router.push(`/(admin)/support/${sr.id}`)}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: i < Math.min(detail.support_requests.length, 5) - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{sr.category.replace(/_/g, ' ')}</Text>
                  <Text style={{ fontSize: 12, color: STATUS_COLORS[sr.status] || colors.textSecondary }}>{sr.status}</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.textPrimary, marginTop: 2 }} numberOfLines={1}>{sr.message}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {detail.disputes.length > 0 && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B', marginBottom: spacing.md }}>
              DISPUTES ({detail.disputes.length})
            </Text>
            {detail.disputes.slice(0, 5).map((d, i) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push(`/(admin)/disputes/${d.id}`)}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: i < Math.min(detail.disputes.length, 5) - 1 ? 1 : 0,
                  borderBottomColor: '#FECACA',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#DC2626' }}>{d.category}</Text>
                  <Text style={{ fontSize: 12, color: d.resolved_at ? '#10B981' : '#DC2626' }}>{d.status}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>{formatDateTime(d.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}