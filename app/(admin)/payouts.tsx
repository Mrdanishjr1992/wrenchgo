import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListPayouts, AdminPayout, formatCents, formatDateTime } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, PAYOUT_STATUSES } from '../../src/lib/admin-filters';
import { 
  AdminHeader, 
  FilterRow,
  AdminLoadingState, 
  AdminEmptyState, 
  AdminErrorState,
  AdminPagination,
  StatusBadge,
} from '../../components/admin/AdminFilterComponents';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';

export default function AdminPayoutsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListPayouts({
        status: filters.status || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setPayouts(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching payouts:', err);
      setError(err?.message ?? 'Failed to load payouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchPayouts(); 
  }, [fetchPayouts, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchPayouts(); };

  const totalNet = payouts.reduce((sum, p) => sum + p.net_amount_cents, 0);
  const totalCommission = payouts.reduce((sum, p) => sum + p.commission_cents, 0);
  const totalGross = payouts.reduce((sum, p) => sum + p.gross_amount_cents, 0);

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Payouts" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Payouts" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchPayouts} />
      </View>
    );
  }

  const InvoiceRow = ({ label, value, color, bold, negative }: { label: string; value: number; color?: string; bold?: boolean; negative?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <ThemedText variant="caption" style={{ fontSize: 11, fontWeight: bold ? '600' : '400', color: color || colors.textPrimary }}>{label}</ThemedText>
      <ThemedText variant="caption" style={{ color: color || colors.textPrimary, fontWeight: bold ? '600' : '400' }}>
        {negative ? '-' : ''}{formatCents(value)}
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Payouts" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: colors.accent }}>{formatCents(totalNet)}</ThemedText>
          <ThemedText variant="caption">Net Payouts</ThemedText>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: '#F59E0B' }}>{formatCents(totalCommission)}</ThemedText>
          <ThemedText variant="caption">Commission</ThemedText>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: '#3B82F6' }}>{formatCents(totalGross)}</ThemedText>
          <ThemedText variant="caption">Gross</ThemedText>
        </View>
      </View>

      <FilterRow
        label="Status"
        options={PAYOUT_STATUSES as any}
        selected={filters.status}
        onSelect={(v) => { updateFilter('status', v); setLoading(true); }}
      />

      <ScrollView 
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {payouts.length === 0 ? (
          <AdminEmptyState 
            icon="wallet-outline" 
            title="No payouts found" 
          />
        ) : (
          payouts.map(payout => (
            <TouchableOpacity 
              key={payout.id} 
              onPress={() => router.push(`/jobs/${payout.job_id}` as any)}
              activeOpacity={0.7}
            >
              <ThemedCard style={{ padding: spacing.md, marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <View>
                    <ThemedText variant="body" style={{ fontWeight: '700', color: colors.accent }}>
                      {formatCents(payout.net_amount_cents)}
                    </ThemedText>
                    {payout.mechanic_name && (
                      <ThemedText variant="caption" style={{ fontSize: 11 }}>
                        {payout.mechanic_name}
                      </ThemedText>
                    )}
                  </View>
                  <StatusBadge status={payout.status} />
                </View>

                <View style={{ backgroundColor: colors.background, borderRadius: 6, padding: spacing.sm, marginBottom: spacing.sm }}>
                  <InvoiceRow label="Gross Amount" value={payout.gross_amount_cents} />
                  <InvoiceRow label="Commission (12%)" value={payout.commission_cents} color="#F59E0B" negative />
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 4 }}>
                    <InvoiceRow label="Net Payout" value={payout.net_amount_cents} color={colors.accent} bold />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText variant="caption" style={{ fontSize: 10, color: colors.textSecondary }}>
                    {payout.processed_at ? `Processed ${formatDateTime(payout.processed_at)}` : formatDateTime(payout.created_at)}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThemedText variant="caption" style={{ fontSize: 10, color: colors.textSecondary }}>
                      View Job
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                  </View>
                </View>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {payouts.length > 0 && (
          <AdminPagination
            currentPage={currentPage}
            hasMore={hasMore}
            onPrevious={prevPage}
            onNext={nextPage}
            loading={loading}
          />
        )}
      </ScrollView>
    </View>
  );
}