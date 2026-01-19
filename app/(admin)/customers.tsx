import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListCustomers, AdminCustomer, formatDateTime } from '../../src/lib/admin';
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

export default function AdminCustomersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();
  
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setError(null);
      const effectiveHubId = scope.isSuper ? filters.hubId : scope.hubId;
      const data = await adminListCustomers({
        hubId: effectiveHubId || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: filters.offset,
      });
      setCustomers(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err?.message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, scope.hubId, scope.isSuper]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchCustomers(); 
  }, [fetchCustomers, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchCustomers(); };
  
  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Customers" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (scope.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Customers" onBack={() => router.back()} />
        <AdminErrorState message={scope.error} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Customers" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchCustomers} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Customers" onBack={() => router.back()} onRefresh={onRefresh} />

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
        {customers.length === 0 ? (
          <AdminEmptyState 
            icon="people-outline" 
            title="No customers found" 
            message={filters.search ? 'Try adjusting your search' : undefined}
          />
        ) : (
          customers.map(customer => (
            <TouchableOpacity
              key={customer.id}
              onPress={() => router.push(`/(admin)/customers/${customer.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>{customer.full_name || 'Unknown'}</ThemedText>
                    {customer.email && (
                      <ThemedText variant="caption" style={{ color: colors.accent, marginTop: 2 }}>{customer.email}</ThemedText>
                    )}
                    {customer.phone && (
                      <ThemedText variant="caption" style={{ marginTop: 2 }}>{customer.phone}</ThemedText>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
                
                {(customer.city || customer.state) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                    <Ionicons name="location" size={12} color={colors.textSecondary} />
                    <ThemedText variant="caption" style={{ marginLeft: 4 }}>
                      {[customer.city, customer.state].filter(Boolean).join(', ')}
                    </ThemedText>
                  </View>
                )}
                <ThemedText variant="caption" style={{ marginTop: spacing.sm, fontSize: 11 }}>
                  Joined {formatDateTime(customer.created_at)}
                </ThemedText>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {customers.length > 0 && (
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
