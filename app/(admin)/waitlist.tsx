import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListWaitlist, AdminWaitlistItem, formatDateTime, adminGetHubRecommendations, HubRecommendation, CreateHubInput } from '../../src/lib/admin';
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
import { CreateHubModal } from '../../components/admin/CreateHubModal';

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
  const [recommendations, setRecommendations] = useState<HubRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<Partial<CreateHubInput> & { city?: string; state?: string } | undefined>();

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

  const fetchRecommendations = useCallback(async () => {
    try {
      const recs = await adminGetHubRecommendations();
      setRecommendations(recs);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!scope.loading) {
      fetchItems();
      fetchRecommendations();
    }
  }, [fetchItems, fetchRecommendations, scope.loading]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
    fetchRecommendations();
  };

  const handleSearch = () => {
    updateFilter('search', searchInput);
    setLoading(true);
  };

  const handleCreateHubFromRecommendation = (rec: HubRecommendation) => {
    setCreatePrefill({
      name: `${rec.city} Hub`,
      city: rec.city,
      state: rec.state,
      country: rec.country,
      lat: rec.avg_lat,
      lng: rec.avg_lng,
      active_radius_miles: Math.min(rec.suggested_radius, 15),
      max_radius_miles: rec.suggested_radius,
    });
    setShowCreateModal(true);
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
        {recommendations.length > 0 && scope.isSuper && (
          <View style={{ marginBottom: spacing.lg }}>
            <TouchableOpacity
              onPress={() => setShowRecommendations(!showRecommendations)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="bulb" size={18} color="#F59E0B" />
                <ThemedText variant="body" style={{ fontWeight: '600' }}>Recommended Hub Locations</ThemedText>
              </View>
              <Ionicons name={showRecommendations ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showRecommendations && recommendations.map((rec, idx) => (
              <ThemedCard key={idx} style={{ padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>{rec.city}{rec.state ? `, ${rec.state}` : ''}</ThemedText>
                    <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                      <ThemedText variant="caption">
                        <ThemedText variant="caption" style={{ color: '#10B981' }}>{rec.customer_count}</ThemedText> customers
                      </ThemedText>
                      <ThemedText variant="caption">
                        <ThemedText variant="caption" style={{ color: '#3B82F6' }}>{rec.mechanic_count}</ThemedText> mechanics
                      </ThemedText>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{
                      backgroundColor: rec.readiness_score >= 70 ? '#10B98120' : rec.readiness_score >= 40 ? '#F59E0B20' : '#EF444420',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}>
                      <ThemedText variant="caption" style={{
                        color: rec.readiness_score >= 70 ? '#10B981' : rec.readiness_score >= 40 ? '#F59E0B' : '#EF4444',
                        fontWeight: '600',
                      }}>
                        {rec.readiness_score}% ready
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md }}>
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 10 }}>DEMAND</ThemedText>
                    <View style={{ width: 60, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 2 }}>
                      <View style={{ width: `${rec.demand_score}%`, height: 4, backgroundColor: '#10B981', borderRadius: 2 }} />
                    </View>
                  </View>
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 10 }}>SUPPLY</ThemedText>
                    <View style={{ width: 60, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 2 }}>
                      <View style={{ width: `${rec.supply_score}%`, height: 4, backgroundColor: '#3B82F6', borderRadius: 2 }} />
                    </View>
                  </View>
                  <View>
                    <ThemedText variant="caption" style={{ fontSize: 10 }}>SUGGESTED</ThemedText>
                    <ThemedText variant="caption">{rec.suggested_radius} mi</ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleCreateHubFromRecommendation(rec)}
                  style={{
                    marginTop: spacing.sm,
                    backgroundColor: colors.primary,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.md,
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="add-circle" size={14} color="#fff" />
                  <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Create Hub Here</ThemedText>
                </TouchableOpacity>
              </ThemedCard>
            ))}
          </View>
        )}

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

      <CreateHubModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchRecommendations();
          router.push('/(admin)/hubs');
        }}
        prefill={createPrefill}
      />
    </View>
  );
}
