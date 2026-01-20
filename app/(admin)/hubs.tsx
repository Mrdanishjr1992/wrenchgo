import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListHubs, AdminHub, CreateHubInput } from '../../src/lib/admin';
import { useAdminScope, useAdminFilters } from '../../src/lib/admin-filters';
import {
  AdminHeader,
  AdminSearchBar,
  AdminLoadingState,
  AdminEmptyState,
  AdminErrorState,
  AdminPagination,
} from '../../components/admin/AdminFilterComponents';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';
import { CreateHubModal } from '../../components/admin/CreateHubModal';

export default function AdminHubsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { filters, updateFilter, currentPage, nextPage, prevPage } = useAdminFilters();

  const [hubs, setHubs] = useState<AdminHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<Partial<CreateHubInput> & { city?: string; state?: string } | undefined>();

  const fetchHubs = useCallback(async () => {
    try {
      setError(null);
      const data = await adminListHubs({
        search: filters.search || undefined,
        limit: filters.limit,
        offset: filters.offset,
      });
      setHubs(data);
      setHasMore(data.length === filters.limit);
    } catch (err: any) {
      console.error('Error fetching hubs:', err);
      setError(err?.message ?? 'Failed to load hubs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchHubs(); 
  }, [fetchHubs, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchHubs(); };
  
  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Hubs" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Hubs" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchHubs} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Hubs" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <AdminSearchBar
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={handleSearch}
              placeholder="Search by name, slug, or zip..."
            />
          </View>
          <TouchableOpacity
            onPress={() => { setCreatePrefill(undefined); setShowCreateModal(true); }}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.md,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row',
              gap: 4,
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>New Hub</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {hubs.length === 0 ? (
          <AdminEmptyState 
            icon="location-outline" 
            title="No hubs found" 
          />
        ) : (
          hubs.map(hub => (
            <TouchableOpacity
              key={hub.id}
              onPress={() => router.push(`/(admin)/hubs/${hub.id}`)}
              style={{ marginBottom: spacing.md }}
            >
              <ThemedCard style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>{hub.name}</ThemedText>
                    <ThemedText variant="caption" style={{ marginTop: 2 }}>{hub.slug}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!hub.is_active && (
                      <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <ThemedText variant="caption" style={{ color: '#EF4444', fontSize: 10 }}>INACTIVE</ThemedText>
                      </View>
                    )}
                    {hub.invite_only && (
                      <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <ThemedText variant="caption" style={{ color: '#F59E0B', fontSize: 10 }}>INVITE ONLY</ThemedText>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                  <Ionicons name="location" size={12} color={colors.textSecondary} />
                  <ThemedText variant="caption" style={{ marginLeft: 4 }}>
                    {hub.zip}
                  </ThemedText>
                </View>

                <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.lg }}>
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 11 }}>ACTIVE RADIUS</ThemedText>
                    <ThemedText variant="caption">{hub.active_radius_miles} mi</ThemedText>
                  </View>
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 11 }}>MAX RADIUS</ThemedText>
                    <ThemedText variant="caption">{hub.max_radius_miles} mi</ThemedText>
                  </View>
                </View>
              </ThemedCard>
            </TouchableOpacity>
          ))
        )}
        
        {hubs.length > 0 && (
          <AdminPagination
            currentPage={currentPage}
            hasMore={hasMore}
            onPrevious={prevPage}
            onNext={nextPage}
            loading={loading}
          />
        )}
      </ScrollView>

      <CreateHubModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchHubs}
        prefill={createPrefill}
      />
    </View>
  );
}
