import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListJobs, AdminJob, formatDateTime, formatCents } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters, useAdminHubs, JOB_STATUSES } from '../../src/lib/admin-filters';
import { 
  AdminHeader, 
  AdminSearchBar, 
  HubSelector, 
  FilterRow,
  AdminLoadingState, 
  AdminEmptyState, 
  AdminErrorState,
  AdminPagination,
  StatusBadge,
} from '../../components/admin/AdminFilterComponents';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';

export default function AdminJobsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const effectiveHubId = scope.isSuper ? filters.hubId : scope.hubId;
      const data = await adminListJobs({
        status: filters.status || undefined,
        hubId: effectiveHubId || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setJobs(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      setError(err?.message ?? 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, scope.hubId, scope.isSuper]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchJobs(); 
  }, [fetchJobs, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchJobs(); };
  
  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Jobs" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (scope.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Jobs" onBack={() => router.back()} />
        <AdminErrorState message={scope.error} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Jobs" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchJobs} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Jobs" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <AdminSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={handleSearch}
          placeholder="Search by title..."
        />
        
        {scope.isSuper && !hubsLoading && (
          <HubSelector
            hubs={hubs}
            selectedHubId={filters.hubId}
            onSelect={(id) => { updateFilter('hubId', id); setLoading(true); }}
          />
        )}
      </View>

      <FilterRow
        label="Status"
        options={JOB_STATUSES as any}
        selected={filters.status}
        onSelect={(v) => { updateFilter('status', v); setLoading(true); }}
      />

      <ScrollView 
        style={{ flex: 1, marginTop: spacing.md }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {jobs.length === 0 ? (
          <AdminEmptyState 
            icon="construct-outline" 
            title="No jobs found" 
            message={filters.search ? 'Try adjusting your search' : undefined}
          />
        ) : (
          jobs.map(job => (
            <TouchableOpacity
              key={job.id}
              onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <StatusBadge status={job.status} />
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
                
                <ThemedText variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{job.title}</ThemedText>
                {job.customer_name && (
                  <ThemedText variant="caption" style={{ marginTop: 4 }}>
                    Customer: {job.customer_name}
                  </ThemedText>
                )}
                {job.mechanic_name && (
                  <ThemedText variant="caption">
                    Mechanic: {job.mechanic_name}
                  </ThemedText>
                )}
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  {job.final_price_cents ? (
                    <ThemedText variant="caption" style={{ color: colors.accent }}>
                      {formatCents(job.final_price_cents)}
                    </ThemedText>
                  ) : (
                    <View />
                  )}
                  <ThemedText variant="caption">
                    {formatDateTime(job.created_at)}
                  </ThemedText>
                </View>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {jobs.length > 0 && (
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
