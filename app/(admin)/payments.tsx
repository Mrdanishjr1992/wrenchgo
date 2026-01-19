import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListPayments, AdminPayment, formatCents, formatDateTime } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, PAYMENT_STATUSES } from '../../src/lib/admin-filters';
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

export default function AdminPaymentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListPayments({
        status: filters.status || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setPayments(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError(err?.message ?? 'Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchPayments(); 
  }, [fetchPayments, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchPayments(); };

  const totalCustomer = payments.reduce((sum, p) => sum + p.total_customer_cents, 0);
  const totalSubtotal = payments.reduce((sum, p) => sum + p.subtotal_cents, 0);
  const totalFees = payments.reduce((sum, p) => sum + p.platform_fee_cents, 0);

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Payments" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Payments" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchPayments} />
      </View>
    );
  }

  const InvoiceRow = ({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <ThemedText variant="caption" style={{ fontSize: 11, fontWeight: bold ? '600' : '400' }}>{label}</ThemedText>
      <ThemedText variant="caption" style={{ color: color || colors.textPrimary, fontWeight: bold ? '600' : '400' }}>
        {formatCents(value)}
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Payments" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: colors.accent }}>{formatCents(totalCustomer)}</ThemedText>
          <ThemedText variant="caption">Customer Total</ThemedText>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: '#3B82F6' }}>{formatCents(totalSubtotal)}</ThemedText>
          <ThemedText variant="caption">Subtotal</ThemedText>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: '#10B981' }}>{formatCents(totalFees)}</ThemedText>
          <ThemedText variant="caption">Platform Fees</ThemedText>
        </View>
      </View>

      <FilterRow
        label="Status"
        options={PAYMENT_STATUSES as any}
        selected={filters.status}
        onSelect={(v) => { updateFilter('status', v); setLoading(true); }}
      />

      <ScrollView 
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {payments.length === 0 ? (
          <AdminEmptyState 
            icon="card-outline" 
            title="No payments found" 
          />
        ) : (
          payments.map(payment => (
            <TouchableOpacity 
              key={payment.id} 
              onPress={() => router.push(`/jobs/${payment.job_id}` as any)}
              activeOpacity={0.7}
            >
              <ThemedCard style={{ padding: spacing.md, marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <View>
                    <ThemedText variant="body" style={{ fontWeight: '700', color: colors.accent }}>
                      {formatCents(payment.total_customer_cents)}
                    </ThemedText>
                    {payment.customer_name && (
                      <ThemedText variant="caption" style={{ fontSize: 11 }}>
                        {payment.customer_name}
                      </ThemedText>
                    )}
                  </View>
                  <StatusBadge status={payment.status} />
                </View>

                <View style={{ backgroundColor: colors.background, borderRadius: 6, padding: spacing.sm, marginBottom: spacing.sm }}>
                  <InvoiceRow label="Subtotal" value={payment.subtotal_cents} />
                  <InvoiceRow label="Platform Fee" value={payment.platform_fee_cents} color="#10B981" />
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 4 }}>
                    <InvoiceRow label="Customer Total" value={payment.total_customer_cents} color={colors.accent} bold />
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <InvoiceRow label="Mechanic Payout" value={payment.mechanic_payout_cents} color="#3B82F6" />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    {payment.mechanic_name && (
                      <ThemedText variant="caption" style={{ fontSize: 11 }}>
                        Mechanic: {payment.mechanic_name}
                      </ThemedText>
                    )}
                    <ThemedText variant="caption" style={{ fontSize: 10, color: colors.textSecondary }}>
                      {payment.paid_at ? `Paid ${formatDateTime(payment.paid_at)}` : formatDateTime(payment.created_at)}
                    </ThemedText>
                  </View>
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
        
        {payments.length > 0 && (
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