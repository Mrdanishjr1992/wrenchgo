import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListSupportRequests, AdminSupportRequestEnriched, formatDateTime } from '../../src/lib/admin';

const CATEGORY_COLORS: Record<string, string> = {
  payments_refunds: '#EF4444',
  job_issue: '#F59E0B',
  account_login: '#3B82F6',
  bug_app_problem: '#8B5CF6',
  other: '#6B7280',
};

export default function AdminSupportScreen() {
  const { colors } = useTheme();
  const [requests, setRequests] = useState<AdminSupportRequestEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await adminListSupportRequests(
        statusFilter || undefined,
        categoryFilter || undefined
      );
      setRequests(data);
    } catch (error) {
      console.error('Error fetching support requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, categoryFilter]);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  const onRefresh = () => { setRefreshing(true); fetchRequests(); };

  const FilterButton = ({ value, label, current, onPress }: { value: string | null; label: string; current: string | null; onPress: (v: string | null) => void }) => (
    <TouchableOpacity
      onPress={() => onPress(current === value ? null : value)}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: current === value ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: current === value ? colors.accent : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ color: current === value ? '#fff' : colors.textSecondary, fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Support Requests</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Filter by Status
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        <FilterButton value={null} label="All" current={statusFilter} onPress={setStatusFilter} />
        <FilterButton value="open" label="Open" current={statusFilter} onPress={setStatusFilter} />
        <FilterButton value="resolved" label="Resolved" current={statusFilter} onPress={setStatusFilter} />
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Filter by Category
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        <FilterButton value={null} label="All" current={categoryFilter} onPress={setCategoryFilter} />
        <FilterButton value="payments_refunds" label="Payments" current={categoryFilter} onPress={setCategoryFilter} />
        <FilterButton value="job_issue" label="Job Issue" current={categoryFilter} onPress={setCategoryFilter} />
        <FilterButton value="account_login" label="Account" current={categoryFilter} onPress={setCategoryFilter} />
        <FilterButton value="bug_app_problem" label="Bug" current={categoryFilter} onPress={setCategoryFilter} />
        <FilterButton value="other" label="Other" current={categoryFilter} onPress={setCategoryFilter} />
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {requests.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No support requests found</Text>
        ) : (
          requests.map(req => (
            <TouchableOpacity
              key={req.support_request_id}
              onPress={() => router.push(`/(admin)/support/${req.support_request_id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: CATEGORY_COLORS[req.category] || colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: (CATEGORY_COLORS[req.category] || colors.textSecondary) + '20',
                }}>
                  <Text style={{ color: CATEGORY_COLORS[req.category] || colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {req.category.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: req.status === 'resolved' ? '#10B981' : colors.textSecondary, fontSize: 12 }}>{req.status}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>{req.message}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                {req.user_name} ({req.user_role})
              </Text>
              {req.user_email && (
                <Text style={{ fontSize: 12, color: colors.accent, marginTop: 2 }}>{req.user_email}</Text>
              )}
              {req.job_id && (
                <Text style={{ fontSize: 12, color: '#F59E0B', marginTop: 4 }}>Has linked job</Text>
              )}
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>
                {formatDateTime(req.created_at)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}