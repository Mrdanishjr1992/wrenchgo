import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListDisputes, AdminDispute, formatDateTime } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, useAdminHubs, DISPUTE_STATUSES } from '../../src/lib/admin-filters';
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

export default function AdminDisputesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListDisputes({
        status: filters.status || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setDisputes(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching disputes:', err);
      setError(err?.message ?? 'Failed to load disputes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchDisputes(); 
  }, [fetchDisputes, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchDisputes(); };

  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'in_review').length;

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Disputes" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (scope.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Disputes" onBack={() => router.back()} />
        <AdminErrorState message={scope.error} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Disputes" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchDisputes} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Disputes" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.md }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: colors.warning }}>{openCount}</ThemedText>
          <ThemedText variant="caption">Open</ThemedText>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title">{disputes.length}</ThemedText>
          <ThemedText variant="caption">Total</ThemedText>
        </View>
      </View>

      <FilterRow
        label="Status"
        options={DISPUTE_STATUSES as any}
        selected={filters.status}
        onSelect={(v) => { updateFilter('status', v); setLoading(true); }}
      />

      <ScrollView 
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {disputes.length === 0 ? (
          <AdminEmptyState 
            icon="alert-circle-outline" 
            title="No disputes found" 
          />
        ) : (
          disputes.map(dispute => (
            <TouchableOpacity
              key={dispute.id}
              onPress={() => router.push(`/(admin)/disputes/${dispute.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <StatusBadge status={dispute.status} />
                    {dispute.priority && <StatusBadge status={dispute.priority} />}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
                
                <ThemedText variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {dispute.job_title || 'Job Dispute'}
                </ThemedText>
                
                <ThemedText variant="caption" style={{ marginTop: 4 }}>
                  Category: {dispute.category}
                </ThemedText>
                
                <ThemedText variant="caption" style={{ marginTop: spacing.sm, fontSize: 11 }}>
                  Filed by: {dispute.filed_by_role}
                </ThemedText>
                
                <ThemedText variant="caption" style={{ marginTop: 4, fontSize: 11 }}>
                  {formatDateTime(dispute.created_at)}
                </ThemedText>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {disputes.length > 0 && (
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
