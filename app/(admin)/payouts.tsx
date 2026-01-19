import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetPayouts, AdminPayout, formatCents, formatDateTime } from '../../src/lib/admin';
import { getStatusColor } from '../../src/lib/admin-colors';

export default function AdminPayoutsScreen() {
  const { colors, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    try {
      const data = await adminGetPayouts(statusFilter || undefined);
      setPayouts(data);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { fetchPayouts(); }, [fetchPayouts]));

  const onRefresh = () => { setRefreshing(true); fetchPayouts(); };

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom }}>
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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Payouts</Text>
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
        <FilterButton value="processing" label="Processing" />
        <FilterButton value="completed" label="Completed" />
      </ScrollView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {payouts.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No payouts found</Text>
        ) : (
          payouts.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => router.push(`/(admin)/mechanics/${p.mechanic_id}`)}
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
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{formatCents(p.net_amount_cents)}</Text>
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: withAlpha(getStatusColor(p.status, colors), 0.12),
                }}>
                  <Text style={{ color: getStatusColor(p.status, colors), fontSize: 11, fontWeight: '600' }}>
                    {p.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, color: colors.textPrimary }}>Mechanic: {p.mechanic_name}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                Gross: {formatCents(p.gross_amount_cents)} | Commission: {formatCents(p.commission_cents)}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Created: {formatDateTime(p.created_at)}</Text>
                {p.processed_at && <Text style={{ fontSize: 12, color: colors.success }}>Processed {formatDateTime(p.processed_at)}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}