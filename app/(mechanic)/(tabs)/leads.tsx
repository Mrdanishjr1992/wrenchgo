import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
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

  const { leads, summary, loading, error, hasMore, refetch, loadMore, changeSortBy } = useMechanicLeads(
    mechanicId,
    filter,
    location?.latitude,
    location?.longitude,
    25
  );

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

  const handleViewJob = (jobId: string) => {
    router.push(`/(mechanic)/job-detail/${jobId}`);
  };

  const handleQuoteJob = (jobId: string) => {
    router.push(`/(mechanic)/quote-composer/${jobId}`);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Leads</Text>
      </View>

      <View style={[styles.filterTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'all' ? { color: colors.accent, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'nearby' && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('nearby')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'nearby' ? { color: colors.accent, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            Nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'quoted' && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('quoted')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'quoted' ? { color: colors.accent, fontWeight: '600' } : { color: colors.textMuted },
            ]}
          >
            Quoted
          </Text>
        </TouchableOpacity>
      </View>

      <LeadsHeader summary={summary} sortBy="newest" onChangeSortBy={changeSortBy} />

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
              refreshing={false}
              onRefresh={refetch}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              loadMore();
            }
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  filterTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
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
