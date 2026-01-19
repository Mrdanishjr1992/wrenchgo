import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListWaitlist, AdminWaitlistItem, formatDateTime } from '../../src/lib/admin';
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

export default function AdminWaitlistScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [items, setItems] = useState<AdminWaitlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListWaitlist({
        hubId: filters.hubId || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setItems(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching waitlist:', err);
      setError(err?.message ?? 'Failed to load waitlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

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
        <AdminHeader title="Waitlist" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Waitlist" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchItems} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Waitlist" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.md }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title">{items.length}</ThemedText>
          <ThemedText variant="caption">Total</ThemedText>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="title" style={{ color: '#10B981' }}>
            {items.filter(i => i.converted_at).length}
          </ThemedText>
          <ThemedText variant="caption">Converted</ThemedText>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <AdminSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={handleSearch}
          placeholder="Search by email or zip..."
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
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <AdminEmptyState 
            icon="people-outline" 
            title="No waitlist entries" 
          />
        ) : (
          items.map(item => (
            <ThemedCard key={item.id} style={{ padding: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{ fontWeight: '600' }}>{item.email}</ThemedText>
                  {item.phone && (
                    <ThemedText variant="caption" style={{ marginTop: 2 }}>{item.phone}</ThemedText>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {item.user_type && (
                    <View style={{ backgroundColor: item.user_type === 'mechanic' ? '#3B82F620' : '#10B98120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <ThemedText variant="caption" style={{ color: item.user_type === 'mechanic' ? '#3B82F6' : '#10B981', fontSize: 10 }}>
                        {item.user_type.toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  {item.converted_at && (
                    <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <ThemedText variant="caption" style={{ color: '#10B981', fontSize: 10 }}>CONVERTED</ThemedText>
                    </View>
                  )}
                  {item.invited_at && !item.converted_at && (
                    <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <ThemedText variant="caption" style={{ color: '#F59E0B', fontSize: 10 }}>INVITED</ThemedText>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.lg }}>
                <View>
                  <ThemedText variant="caption" style={{ fontSize: 11 }}>ZIP</ThemedText>
                  <ThemedText variant="caption">{item.zip}</ThemedText>
                </View>
                {item.distance_miles != null && (
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 11 }}>DISTANCE</ThemedText>
                    <ThemedText variant="caption">{item.distance_miles.toFixed(1)} mi</ThemedText>
                  </View>
                )}
                {item.ring != null && (
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 11 }}>RING</ThemedText>
                    <ThemedText variant="caption">{item.ring}</ThemedText>
                  </View>
                )}
              </View>
              
              <ThemedText variant="caption" style={{ marginTop: spacing.sm, fontSize: 11 }}>
                Joined {formatDateTime(item.created_at)}
              </ThemedText>
            </ThemedCard>
          ))
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
