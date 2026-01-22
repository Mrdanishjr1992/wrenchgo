import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListMechanics, AdminMechanic, formatDateTime } from '../../src/lib/admin';
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

export default function AdminMechanicsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [mechanics, setMechanics] = useState<AdminMechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchMechanics = useCallback(async () => {
    try {
      setError(null);
      const effectiveHubId = scope.isSuper ? filters.hubId : scope.hubId;
      const data = await adminListMechanics({
        hubId: effectiveHubId || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setMechanics(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching mechanics:', err);
      setError(err?.message ?? 'Failed to load mechanics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, scope.hubId, scope.isSuper]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchMechanics(); 
  }, [fetchMechanics, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchMechanics(); };
  
  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Mechanics" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (scope.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Mechanics" onBack={() => router.back()} />
        <AdminErrorState message={scope.error} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Mechanics" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchMechanics} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Mechanics" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <AdminSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={handleSearch}
          placeholder="Search by name, email, or phone..."
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
        {mechanics.length === 0 ? (
          <AdminEmptyState 
            icon="build-outline" 
            title="No mechanics found" 
            message={filters.search ? 'Try adjusting your search' : undefined}
          />
        ) : (
          mechanics.map(m => (
            <TouchableOpacity
              key={m.id}
              onPress={() => router.push(`/(admin)/mechanics/${m.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>{m.full_name || 'Unknown'}</ThemedText>
                    {m.email && (
                      <ThemedText variant="caption" style={{ color: colors.accent, marginTop: 2 }}>{m.email}</ThemedText>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!m.is_available && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="moon" size={14} color={colors.textSecondary} />
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </View>
                
                {(m.city || m.state) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                    <Ionicons name="location" size={12} color={colors.textSecondary} />
                    <ThemedText variant="caption" style={{ marginLeft: 4 }}>
                      {[m.city, m.state].filter(Boolean).join(', ')}
                    </ThemedText>
                  </View>
                )}
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <ThemedText variant="caption">
                    {m.jobs_completed || 0} job{(m.jobs_completed || 0) !== 1 ? 's' : ''} completed
                  </ThemedText>
                  {m.rating_avg != null && m.rating_avg > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="star" size={12} color={colors.warning} />
                      <ThemedText variant="caption" style={{ marginLeft: 4 }}>
                        {Number(m.rating_avg).toFixed(1)} ({m.rating_count || 0})
                      </ThemedText>
                    </View>
                  )}
                </View>
                
                {m.years_experience && (
                  <ThemedText variant="caption" style={{ marginTop: 4 }}>
                    {m.years_experience} years experience
                  </ThemedText>
                )}
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {mechanics.length > 0 && (
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
