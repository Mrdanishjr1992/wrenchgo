import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetSupportDetail, adminUpdateSupportStatus, formatDateTime } from '../../../src/lib/admin';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  resolved: '#10B981',
};

interface SupportDetail {
  request: {
    id: string;
    user_id: string | null;
    category: string;
    message: string;
    job_id: string | null;
    screenshot_url: string | null;
    metadata: Record<string, any>;
    status: string;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
  } | null;
  job: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export default function AdminSupportDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<SupportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await adminGetSupportDetail(id);
      setDetail(data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err?.message || 'Failed to load support request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      await adminUpdateSupportStatus(id, newStatus);
      fetchDetail();
    } catch (err: any) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

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
        <Text style={{ color: colors.textSecondary }}>{error || 'Support request not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { request, user, job } = detail;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{value || '-'}</Text>
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Support Request</Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: (STATUS_COLORS[request.status] || colors.textSecondary) + '20',
            alignSelf: 'flex-start',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 11, color: STATUS_COLORS[request.status] || colors.textSecondary, fontWeight: '600' }}>
              {request.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Request Details">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Category" value={request.category.replace(/_/g, ' ')} />
            <InfoRow label="Created" value={formatDateTime(request.created_at)} />
            <InfoRow label="Updated" value={formatDateTime(request.updated_at)} />
          </View>
        </Section>

        <Section title="Message">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{request.message}</Text>
          </View>
        </Section>

        {user && (
          <Section title="User">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <InfoRow label="Name" value={user.full_name} />
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="Role" value={user.role} />
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

        <Section title="Actions">
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {user && (
              <TouchableOpacity
                onPress={() => setMessageModalVisible(true)}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  paddingVertical: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Message User</Text>
              </TouchableOpacity>
            )}
            {request.status === 'open' && (
              <TouchableOpacity
                onPress={() => handleUpdateStatus('resolved')}
                disabled={updating}
                style={{
                  flex: 1,
                  backgroundColor: '#10B981',
                  paddingVertical: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: updating ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Mark Resolved</Text>
              </TouchableOpacity>
            )}
            {request.status === 'resolved' && (
              <TouchableOpacity
                onPress={() => handleUpdateStatus('open')}
                disabled={updating}
                style={{
                  flex: 1,
                  backgroundColor: '#F59E0B',
                  paddingVertical: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: updating ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Reopen</Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>
      </ScrollView>

      {user && (
        <AdminMessageModal
          visible={messageModalVisible}
          onClose={() => setMessageModalVisible(false)}
          recipient={{
            id: user.id,
            name: user.full_name || user.email || 'User',
            role: user.role,
          }}
          relatedJobId={job?.id}
          relatedJobTitle={job?.title}
          supportRequestId={request.id}
        />
      )}
    </View>
  );
}