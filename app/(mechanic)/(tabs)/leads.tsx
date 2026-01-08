import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/ui/theme-context';
import { supabase } from '@/src/lib/supabase';
import { useMechanicLeads } from '@/src/hooks/use-mechanic-leads';
import { LeadCard } from '@/components/mechanic/LeadCard';
import { LeadsEmptyState, LeadCardSkeleton } from '@/components/mechanic/LeadsEmptyState';
import { LeadsHeader } from '@/components/mechanic/LeadsHeader';
import type { LeadFilterType } from '@/src/types/mechanic-leads';

export default function MechanicLeadsPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [mechanicId, setMechanicId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadFilterType>('all');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  const { leads, summary, loading, error, hasMore, sortBy, refetch, loadMore, changeSortBy } =
    useMechanicLeads(
      mechanicId,
      filter,
      location?.latitude,
      location?.longitude,
      25
    );

  // Prevent FlatList from calling onEndReached repeatedly
  const endReachedLockRef = useRef(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMechanicId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const requestLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({});
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
        } catch (err) {
          console.error('Error getting location:', err);
        }
      }
    };

    requestLocationPermission();
  }, []);

  // Unlock endReached when inputs change (so pagination works after refetch/filter/sort changes)
  useEffect(() => {
    endReachedLockRef.current = false;
  }, [filter, sortBy, mechanicId, location?.latitude, location?.longitude]);

  const handleViewJob = (jobId: string) => {
    router.push(`/(mechanic)/job-details/${jobId}` as any);
  };

  const handleQuoteJob = (jobId: string) => {
    router.push(`/(mechanic)/quote-composer/${jobId}` as any);
  };

  const handleEnableLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      try {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        refetch();
      } catch (err) {
        Alert.alert('Error', 'Failed to get your location. Please try again.');
      }
    } else {
      Alert.alert(
        'Location Permission Required',
        'Please enable location services in your device settings to see nearby leads.'
      );
    }
  };

  const renderLeadCard = ({ item }: { item: any }) => (
    <LeadCard lead={item} onPressView={handleViewJob} onPressQuote={handleQuoteJob} />
  );

  const renderSkeletons = () => (
    <>
      <LeadCardSkeleton />
      <LeadCardSkeleton />
      <LeadCardSkeleton />
    </>
  );

  const renderEmptyState = () => {
    if (loading) return null;
    return <LeadsEmptyState filter={filter} onEnableLocation={handleEnableLocation} />;
  };

  const renderFooter = () => {
    if (!hasMore || loading) return null;
    return (
      <TouchableOpacity
        style={[styles.loadMoreButton, { backgroundColor: colors.surface2 }]}
        onPress={loadMore}
      >
        <Text style={[styles.loadMoreText, { color: colors.accent }]}>Load More</Text>
      </TouchableOpacity>
    );
  };

  const handleEndReached = useCallback(() => {
    if (endReachedLockRef.current) return;
    if (hasMore && !loading) {
      endReachedLockRef.current = true;
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={[colors.accent, colors.accent + '28']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="briefcase" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Leads</Text>
          </View>
          <Text style={styles.headerSubtitle}>Find your next job opportunity</Text>
        </View>
      </LinearGradient>

      <View style={[styles.filterTabs, { backgroundColor: colors.surface, borderBottomColor: colors.gray }]}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { backgroundColor: colors.primaryBg, borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
          onPress={() => setFilter('all')}
        >
          <Ionicons
            name="list"
            size={18}
            color={filter === 'all' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.filterTabText,
              filter === 'all' ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'nearby' && { backgroundColor: colors.primaryBg, borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
          onPress={() => setFilter('nearby')}
        >
          <Ionicons
            name="location"
            size={18}
            color={filter === 'nearby' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.filterTabText,
              filter === 'nearby' ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            Nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'quoted' && { backgroundColor: colors.primaryBg, borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
          onPress={() => setFilter('quoted')}
        >
          <Ionicons
            name="document-text"
            size={18}
            color={filter === 'quoted' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.filterTabText,
              filter === 'quoted' ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            Quoted
          </Text>
        </TouchableOpacity>
      </View>

      <LeadsHeader summary={summary} sortBy={sortBy} onChangeSortBy={changeSortBy} />

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && leads.length === 0 ? (
        <View style={styles.content}>{renderSkeletons()}</View>
      ) : (
        <FlatList
          data={leads}
          renderItem={renderLeadCard}
          keyExtractor={(item) => item.job_id}
          contentContainerStyle={[
            styles.listContent,
            leads.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={loading && leads.length > 0}
              onRefresh={() => {
                endReachedLockRef.current = false;
                refetch();
              }}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          onEndReached={handleEndReached}
          onMomentumScrollBegin={() => {
            endReachedLockRef.current = false;
          }}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    gap: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginLeft: 44,
  },
  filterTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  filterTabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    textAlign: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
