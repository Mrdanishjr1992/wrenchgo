import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
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
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from '@/src/onboarding';
import { getVerificationStatus, type VerificationStatus } from '@/src/lib/verification';
import { VERIFICATION_STATUS, VERIFICATION_STATUS_LABELS } from '@/src/constants/verification';

export default function MechanicLeadsPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [mechanicId, setMechanicId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadFilterType>('all');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  const { leads, summary, loading, error, hasMore, sortBy, profileStatus, refetch, loadMore, changeSortBy } =
    useMechanicLeads(
      mechanicId,
      filter,
      location?.latitude,
      location?.longitude,
      25
    );

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
    const fetchVerificationStatus = async () => {
      if (!mechanicId) return;
      setVerificationLoading(true);
      try {
        const status = await getVerificationStatus(mechanicId);
        setVerificationStatus(status);
      } catch (err) {
        console.error('Error fetching verification status:', err);
      } finally {
        setVerificationLoading(false);
      }
    };
    fetchVerificationStatus();
  }, [mechanicId]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

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

  const handleSetHomeLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location Permission Required', 'Please enable location services to set your service location.');
      return;
    }

    setSettingLocation(true);
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = currentLocation.coords;

      setLocation({ latitude, longitude });

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ home_lat: latitude, home_lng: longitude })
        .eq('id', mechanicId);

      if (updateError) {
        Alert.alert('Error', 'Failed to save location. Please try again.');
        return;
      }

      Alert.alert('Success', 'Your service location has been set!');
      refetch();
    } catch (err) {
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setSettingLocation(false);
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
    
    if (profileStatus && !profileStatus.hasLocation) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="location-outline" size={48} color={colors.warning || '#D97706'} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Set your service location</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            Use your current location to see available leads in your area.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={handleSetHomeLocation}
          >
            <Text style={styles.actionButtonText}>Use Current Location</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (profileStatus && profileStatus.hasLocation && !profileStatus.isInServiceArea) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.warningBg || colors.surface2 }]}>
            <Ionicons name="map-outline" size={48} color={colors.warning || colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Service coming soon</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            WrenchGo isn't available in your area yet, but we're expanding! We'll notify you when service opens near you.
          </Text>
        </View>
      );
    }
    
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

  const showLocationBanner = profileStatus && !profileStatus.hasLocation;
  const showServiceAreaBanner = profileStatus && profileStatus.hasLocation && !profileStatus.isInServiceArea;

  const isVerified = verificationStatus?.status === VERIFICATION_STATUS.ACTIVE;

  if (verificationLoading) {
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
              <Ionicons name="briefcase" size={24} color={colors.textPrimary} />
              <Text style={styles.headerTitle}>Leads</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!isVerified) {
    const statusLabel = verificationStatus?.status
      ? VERIFICATION_STATUS_LABELS[verificationStatus.status as keyof typeof VERIFICATION_STATUS_LABELS]
      : 'Pending Verification';
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
              <Ionicons name="briefcase" size={24} color={colors.textPrimary} />
              <Text style={styles.headerTitle}>Leads</Text>
            </View>
          </View>
        </LinearGradient>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', gap: 16 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.warning + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.warning || '#D97706'} />
            </View>
            <Text style={{
              fontSize: 22,
              fontWeight: '800',
              color: colors.textPrimary,
              textAlign: 'center',
            }}>
              Verification Required
            </Text>
            <Text style={{
              fontSize: 15,
              color: colors.textMuted,
              textAlign: 'center',
              lineHeight: 22,
            }}>
              Complete your profile verification to access leads and start quoting jobs.
            </Text>
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: colors.warning + '20',
              marginTop: 8,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.warning || '#D97706' }}>
                Status: {statusLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(mechanic)/(tabs)/profile')}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 12,
                marginTop: 16,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.black }}>
                Complete Verification
              </Text>
            </TouchableOpacity>
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: 8,
            }}>
              Go to your profile to upload required documents and complete the vetting questionnaire.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

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
            <Ionicons name="briefcase" size={24} color={colors.textPrimary} />
            <Text style={styles.headerTitle}>Leads</Text>
          </View>
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

      {showLocationBanner && (
        <TouchableOpacity
          style={[styles.setLocationBanner, { backgroundColor: colors.warningBg || colors.surface2 }]}
          onPress={handleSetHomeLocation}
          disabled={settingLocation}
        >
          {settingLocation ? (
            <>
              <ActivityIndicator size="small" color={colors.warning || colors.textMuted} />
              <Text style={[styles.setLocationText, { color: colors.warning || colors.textPrimary }]}>
                Setting your location...
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="location-outline" size={20} color={colors.warning || colors.textMuted} />
              <Text style={[styles.setLocationText, { color: colors.warning || colors.textPrimary }]}>
                Tap to set your service location
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.warning || colors.textMuted} />
            </>
          )}
        </TouchableOpacity>
      )}

      {showServiceAreaBanner && (
        <View style={[styles.setLocationBanner, { backgroundColor: colors.infoBg || colors.surface2 }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info || colors.textMuted} />
          <Text style={[styles.setLocationText, { color: colors.info || colors.textPrimary }]}>
            WrenchGo service is expanding to your area soon
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.errorBg || colors.surface2 }]}>
          <Text style={[styles.errorText, { color: colors.error || colors.textPrimary }]}>{error}</Text>
        </View>
      )}

      {loading && leads.length === 0 ? (
        <View style={styles.content}>{renderSkeletons()}</View>
      ) : (
        <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_LEADS_LIST} style={{ flex: 1 }}>
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
        </WalkthroughTarget>
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
    paddingBottom: 12,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    paddingTop: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    marginLeft: 34,
  },
  filterTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  filterTabText: {
    fontSize: 14,
  },
  setLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    gap: 10,
  },
  setLocationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  loadMoreButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
