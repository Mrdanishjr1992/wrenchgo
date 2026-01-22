import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListSupportThreads, AdminSupportThread, formatDateTime } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, SUPPORT_STATUSES } from '../../src/lib/admin-filters';
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

export default function AdminSupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [threads, setThreads] = useState<AdminSupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListSupportThreads({
        status: filters.status || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setThreads(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching support threads:', err);
      setError(err?.message ?? 'Failed to load support requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchThreads(); 
  }, [fetchThreads, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchThreads(); };

  const openCount = threads.filter(t => t.status === 'open').length;

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Support" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Support" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchThreads} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Support" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.md }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: colors.warning }}>{openCount}</ThemedText>
          <ThemedText variant="caption">Open</ThemedText>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title">{threads.length}</ThemedText>
          <ThemedText variant="caption">Total</ThemedText>
        </View>
      </View>

      <FilterRow
        label="Status"
        options={SUPPORT_STATUSES as any}
        selected={filters.status}
        onSelect={(v) => { updateFilter('status', v); setLoading(true); }}
      />

      <ScrollView 
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {threads.length === 0 ? (
          <AdminEmptyState 
            icon="chatbubbles-outline" 
            title="No support requests found" 
          />
        ) : (
          threads.map(thread => (
            <TouchableOpacity
              key={thread.id}
              onPress={() => router.push(`/(admin)/support/${thread.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <StatusBadge status={thread.status} />
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
                
                <ThemedText variant="body" style={{ fontWeight: '600' }} numberOfLines={2}>
                  {thread.message}
                </ThemedText>
                
                <ThemedText variant="caption" style={{ marginTop: 4 }}>
                  Category: {thread.category.replace(/_/g, ' ')}
                </ThemedText>
                
                {thread.user_name && (
                  <ThemedText variant="caption" style={{ marginTop: 4 }}>
                    From: {thread.user_name}
                  </ThemedText>
                )}
                
                <ThemedText variant="caption" style={{ marginTop: spacing.sm, fontSize: 11 }}>
                  {formatDateTime(thread.created_at)}
                </ThemedText>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {threads.length > 0 && (
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
