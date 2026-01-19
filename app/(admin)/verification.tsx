import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListVerificationQueue, AdminVerificationItem, formatDateTime } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, useAdminHubs } from '../../src/lib/admin-filters';
import {
  AdminHeader,
  AdminSearchBar,
  HubSelector,
  AdminLoadingState,
  AdminEmptyState,
  AdminErrorState,
  AdminPagination,
} from '../../components/admin/AdminFilterComponents';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';

const STATUS_COLORS: Record<string, string> = {
  pending_verification: '#F59E0B',
  active: '#10B981',
  paused: '#6B7280',
  removed: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'PENDING',
  active: 'ACTIVE',
  paused: 'PAUSED',
  removed: 'REMOVED',
};

export default function AdminVerificationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [items, setItems] = useState<AdminVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const effectiveHubId = scope.isSuper ? filters.hubId : scope.hubId;
      const data = await adminListVerificationQueue({
        hubId: effectiveHubId || undefined,
        search: filters.search || undefined,
        limit: filters.limit,
        offset: filters.offset,
      });
      setItems(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching verification queue:', err);
      setError(err?.message ?? 'Failed to load verification queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, scope.hubId, scope.isSuper]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchItems(); 
  }, [fetchItems, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchItems(); };
  
  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Verification Queue" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Verification Queue" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchItems} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Verification Queue" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <AdminSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={handleSearch}
          placeholder="Search by name or email..."
        />
        
        {scope.isSuper && !hubsLoading && (
          <HubSelector
            hubs={hubs}
            selectedHubId={filters.hubId}
            onSelect={(id) => { updateFilter('hubId', id); setLoading(true); }}
          />
        )}
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <AdminEmptyState 
            icon="checkmark-circle-outline" 
            title="No pending verifications" 
          />
        ) : (
          items.map(item => {
            const status = item.verification_status || 'pending_verification';
            const statusColor = STATUS_COLORS[status] || '#F59E0B';
            const statusLabel = STATUS_LABELS[status] || status.toUpperCase().replace(/_/g, ' ');
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/(admin)/verification/${item.id}`)}
                style={{ marginBottom: spacing.md }}
              >
                <ThemedCard style={{ padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="body" style={{ fontWeight: '600' }}>{item.full_name || 'Unknown'}</ThemedText>
                      {item.email && (
                        <ThemedText variant="caption" style={{ color: colors.accent, marginTop: 2 }}>{item.email}</ThemedText>
                      )}
                      {item.phone && (
                        <ThemedText variant="caption" style={{ marginTop: 2 }}>{item.phone}</ThemedText>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <ThemedText variant="caption" style={{ color: statusColor, fontSize: 10 }}>{statusLabel}</ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </View>
                  </View>

                  <ThemedText variant="caption" style={{ marginTop: spacing.sm, fontSize: 11 }}>
                    Applied {formatDateTime(item.created_at)}
                  </ThemedText>
                </ThemedCard>
              </TouchableOpacity>
            );
          })
        )}
        
        {items.length > 0 && (
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
