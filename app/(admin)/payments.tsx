import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetPayments, AdminPayment, formatCents, formatDateTime } from '../../src/lib/admin';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  completed: '#10B981',
  failed: '#EF4444',
  refunded: '#8B5CF6',
};

export default function AdminPaymentsScreen() {
  const { colors } = useTheme();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      const data = await adminGetPayments(statusFilter || undefined);
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { fetchPayments(); }, [fetchPayments]));

  const onRefresh = () => { setRefreshing(true); fetchPayments(); };

  const FilterButton = ({ value, label }: { value: string | null; label: string }) => (
    <TouchableOpacity
      onPress={() => setStatusFilter(statusFilter === value ? null : value)}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: statusFilter === value ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: statusFilter === value ? colors.accent : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ color: statusFilter === value ? '#fff' : colors.textSecondary, fontSize: 13 }}>{label}</Text>
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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Payments</Text>
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
        <FilterButton value={null} label="All" />
        <FilterButton value="pending" label="Pending" />
        <FilterButton value="completed" label="Completed" />
        <FilterButton value="refunded" label="Refunded" />
      </ScrollView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {payments.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No payments found</Text>
        ) : (
          payments.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => router.push(`/(admin)/jobs/${p.job_id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{formatCents(p.amount_cents)}</Text>
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: (STATUS_COLORS[p.status] || colors.textSecondary) + '20',
                }}>
                  <Text style={{ color: STATUS_COLORS[p.status] || colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {p.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{p.job_title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Customer: {p.customer_name}</Text>
              {p.mechanic_name && <Text style={{ fontSize: 13, color: colors.textSecondary }}>Mechanic: {p.mechanic_name}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatDateTime(p.created_at)}</Text>
                {p.refunded_at && <Text style={{ fontSize: 12, color: '#8B5CF6' }}>Refunded {formatDateTime(p.refunded_at)}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
