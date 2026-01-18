import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import {
  adminGetSupportRequestDetails,
  adminUpdateSupportRequestStatus,
  AdminSupportRequestDetail,
  formatCents,
  formatDateTime
} from '../../../src/lib/admin';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  resolved: '#10B981',
  pending: '#6B7280',
};

export default function AdminSupportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [detail, setDetail] = useState<AdminSupportRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const data = await adminGetSupportRequestDetails(id);
      setDetail(data);
    } catch (error) {
      console.error('Error fetching support request detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      await adminUpdateSupportRequestStatus(id, newStatus, note || undefined);
      setNote('');
      fetchDetail();
      Alert.alert('Success', `Status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
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

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Support request not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sr = detail.support_request;
  const user = detail.user;
  const job = detail.job;
  const contract = detail.contract;

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Support Request</Text>
        <View style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: (STATUS_COLORS[sr.status] || colors.textSecondary) + '20',
        }}>
          <Text style={{ color: STATUS_COLORS[sr.status] || colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
            {sr.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>MESSAGE</Text>
          <Text style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 22 }}>{sr.message}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.md }}>
            Category: {sr.category.replace(/_/g, ' ')} | {formatDateTime(sr.created_at)}
          </Text>
          {sr.screenshot_url && (
            <Text style={{ fontSize: 12, color: colors.accent, marginTop: spacing.sm }}>Has screenshot attached</Text>
          )}
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>USER</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{user.full_name}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{user.role}</Text>
          {user.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Ionicons name="mail-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.accent, marginLeft: 6 }}>{user.email}</Text>
            </View>
          )}
          {user.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Ionicons name="call-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.accent, marginLeft: 6 }}>{user.phone}</Text>
            </View>
          )}
          {(user.city || user.state) && (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>
              {[user.city, user.state].filter(Boolean).join(', ')}
            </Text>
          )}
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>
            Member since {formatDateTime(user.created_at)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowMessageModal(true)}
              style={{
                flex: 1,
                backgroundColor: '#8B5CF6',
                borderRadius: 8,
                padding: spacing.sm,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>
                Message User
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (user.role === 'mechanic') {
                  router.push(`/(admin)/mechanics/${user.id}`);
                } else {
                  router.push(`/(admin)/customers/${user.id}`);
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                padding: spacing.sm,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                View Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {job && (
          <TouchableOpacity 
            onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>LINKED JOB</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm }}>{job.title}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Status: {job.status}</Text>
            {job.location_address && (
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{job.location_address}</Text>
            )}
          </TouchableOpacity>
        )}

        {contract && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>CONTRACT</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Status</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{contract.status}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Amount</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{formatCents(contract.quoted_price_cents)}</Text>
            </View>
            {contract.completed_at && (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>
                Completed: {formatDateTime(contract.completed_at)}
              </Text>
            )}
          </View>
        )}

        {detail.payments.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>PAYMENTS</Text>
            {detail.payments.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: i < detail.payments.length - 1 ? spacing.sm : 0 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{p.status}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: p.refunded_at ? '#EF4444' : colors.textPrimary }}>
                  {formatCents(p.amount_cents)} {p.refunded_at ? '(Refunded)' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {detail.disputes.length > 0 && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B', marginBottom: spacing.md }}>DISPUTES</Text>
            {detail.disputes.map((d, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => router.push(`/(admin)/disputes/${d.id}`)}
                style={{ marginBottom: i < detail.disputes.length - 1 ? spacing.sm : 0 }}
              >
                <Text style={{ fontSize: 14, color: '#DC2626' }}>{d.category} - {d.status}</Text>
                <Text style={{ fontSize: 12, color: '#991B1B' }}>{formatDateTime(d.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {sr.status !== 'resolved' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>ADMIN ACTIONS</Text>
            <TextInput
              placeholder="Internal note (optional)"
              placeholderTextColor={colors.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              style={{
                backgroundColor: colors.background,
                borderRadius: 8,
                padding: spacing.md,
                color: colors.textPrimary,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: spacing.md,
              }}
            />
            <TouchableOpacity
              onPress={() => handleStatusUpdate('resolved')}
              disabled={updating}
              style={{
                backgroundColor: '#10B981',
                borderRadius: 8,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {updating ? 'Updating...' : 'Mark as Resolved'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {sr.status === 'resolved' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>ADMIN ACTIONS</Text>
            <TouchableOpacity
              onPress={() => handleStatusUpdate('open')}
              disabled={updating}
              style={{
                backgroundColor: '#F59E0B',
                borderRadius: 8,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {updating ? 'Updating...' : 'Reopen Request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AdminMessageModal
        visible={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        recipient={{ id: user.id, name: user.full_name, role: user.role }}
        relatedJobId={job?.id}
        relatedJobTitle={job?.title}
        supportRequestId={sr.id}
      />
    </View>
  );
}