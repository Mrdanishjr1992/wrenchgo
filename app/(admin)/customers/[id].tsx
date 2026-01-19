import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetCustomerDetail, formatCents, formatDateTime } from '../../../src/lib/admin';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#3B82F6',
  pending: '#F59E0B',
  cancelled: '#EF4444',
  open: '#F59E0B',
  resolved: '#10B981',
  succeeded: '#10B981',
};

interface CustomerDetail {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    hub_id: string | null;
    created_at: string;
  };
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    final_price_cents: number | null;
  }>;
}

export default function AdminCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageModalVisible, setMessageModalVisible] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await adminGetCustomerDetail(id);
      setDetail(data);
    } catch (err: any) {
      console.error('Error fetching customer detail:', err);
      setError(err?.message || 'Failed to load customer');
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
        <Text style={{ color: colors.textSecondary }}>{error || 'Customer not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = detail.profile;
  const latestJob = detail.jobs[0];

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
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>{profile.full_name || 'Unknown'}</Text>
          
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
      </ScrollView>

      <AdminMessageModal
        visible={messageModalVisible}
        onClose={() => setMessageModalVisible(false)}
        recipient={{
          id: profile.id,
          name: profile.full_name || profile.email || 'Customer',
          role: 'Customer',
        }}
        relatedJobId={latestJob?.id}
        relatedJobTitle={latestJob?.title}
      />
    </View>
  );
}