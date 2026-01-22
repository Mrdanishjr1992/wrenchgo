import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function FilterTab({
  label,
  icon,
  isActive,
  onPress,
  count,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={[animatedStyle, {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: isActive ? colors.primary : 'transparent',
      }]}
    >
      <Ionicons
        name={isActive ? icon : `${icon}-outline` as any}
        size={16}
        color={isActive ? colors.white : colors.textMuted}
      />
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: isActive ? colors.white : colors.textMuted,
      }}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={{
          backgroundColor: isActive ? withAlpha(colors.white, 0.3) : colors.surface2,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 10,
          minWidth: 20,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: isActive ? colors.white : colors.textMuted,
          }}>{count}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function StatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <View style={{
      flex: 1,
      backgroundColor: withAlpha(color, 0.1),
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: 'center',
    }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
        marginTop: 4,
      }}>{value}</Text>
      <Text style={{
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '500',
      }}>{label}</Text>
    </View>
  );
}

function VerificationRequired({ 
  statusLabel, 
  onComplete 
}: { 
  statusLabel: string;
  onComplete: () => void;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
      }}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.5,
          }}>Leads</Text>
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInDown.delay(100).duration(400)}
          style={{ alignItems: 'center' }}
        >
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: withAlpha(colors.warning, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="shield-checkmark" size={48} color={colors.warning} />
          </View>

          <Text style={{
            fontSize: 24,
            fontWeight: '800',
            color: colors.textPrimary,
            textAlign: 'center',
            marginBottom: spacing.sm,
          }}>Verification Required</Text>

          <Text style={{
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: spacing.lg,
          }}>
            Complete your profile verification to access leads and start quoting jobs.
          </Text>

          <View style={{
            backgroundColor: withAlpha(colors.warning, 0.12),
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            marginBottom: spacing.xl,
          }}>
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: colors.warning,
            }}>Status: {statusLabel}</Text>
          </View>

          <Pressable
            onPress={onComplete}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.buttonText,
            }}>Complete Verification</Text>
          </Pressable>

          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: spacing.md,
            lineHeight: 20,
          }}>
            Go to your profile to upload required documents and complete the vetting questionnaire.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
    borderRadius: radius.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
      }}>
        <View style={[shimmer, { width: 100, height: 32 }]} />
      </View>

      <View style={{
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
      }}>
        <View style={[shimmer, { flex: 1, height: 44, borderRadius: radius.lg }]} />
        <View style={[shimmer, { flex: 1, height: 44, borderRadius: radius.lg }]} />
        <View style={[shimmer, { flex: 1, height: 44, borderRadius: radius.lg }]} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={[shimmer, { height: 160, borderRadius: radius.xl, marginBottom: spacing.md }]} />
        <View style={[shimmer, { height: 160, borderRadius: radius.xl, marginBottom: spacing.md }]} />
        <View style={[shimmer, { height: 160, borderRadius: radius.xl }]} />
      </View>
    </View>
  );
}

function LocationBanner({
  type,
  onSetLocation,
  loading,
}: {
  type: 'no-location' | 'not-in-area';
  onSetLocation?: () => void;
  loading?: boolean;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const isNoLocation = type === 'no-location';

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(300)}>
      <Pressable
        onPress={isNoLocation ? onSetLocation : undefined}
        disabled={loading || !isNoLocation}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: isNoLocation ? colors.warningBg : colors.infoBg,
          padding: spacing.md,
          borderRadius: radius.xl,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          opacity: pressed && isNoLocation ? 0.9 : 1,
        })}
      >
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isNoLocation ? withAlpha(colors.warning, 0.2) : withAlpha(colors.info, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons
            name={isNoLocation ? 'location' : 'information-circle'}
            size={22}
            color={isNoLocation ? colors.warning : colors.info}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '700',
            color: colors.textPrimary,
            marginBottom: 2,
          }}>
            {isNoLocation ? 'Set your service location' : 'Service expanding soon'}
          </Text>
          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
          }}>
            {isNoLocation
              ? 'Tap to use your current location'
              : "We'll notify you when service opens in your area"}
          </Text>
        </View>
        {isNoLocation && (
          <Ionicons name="chevron-forward" size={20} color={colors.warning} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function MechanicLeadsPage() {
  const router = useRouter();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
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

      // Persist hub linkage + waitlist status (best-effort)
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        const zip = rev?.[0]?.postalCode ?? null;
        if (zip) {
          await supabase.rpc('set_my_service_area', {
            p_zip: zip,
            p_lat: latitude,
            p_lng: longitude,
          });
        }
      } catch {
        // Non-blocking
      }

      Alert.alert('Success', 'Your service location has been set!');
      refetch();
    } catch (err) {
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setSettingLocation(false);
    }
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
    return <LoadingSkeleton />;
  }

  if (!isVerified) {
    const statusLabel = verificationStatus?.status
      ? VERIFICATION_STATUS_LABELS[verificationStatus.status as keyof typeof VERIFICATION_STATUS_LABELS]
      : 'Pending Verification';
    return (
      <VerificationRequired
        statusLabel={statusLabel}
        onComplete={() => router.push('/(mechanic)/(tabs)/profile')}
      />
    );
  }

  const renderLeadCard = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).duration(300)}>
      <LeadCard lead={item} onPressView={handleViewJob} onPressQuote={handleQuoteJob} />
    </Animated.View>
  );

  const renderEmptyState = () => {
    if (loading) return null;

    if (profileStatus && !profileStatus.hasLocation) {
      return (
        <Animated.View 
          entering={FadeIn.delay(200).duration(400)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: withAlpha(colors.warning, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="location" size={36} color={colors.warning} />
          </View>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.textPrimary,
            marginBottom: spacing.xs,
          }}>Set your service location</Text>
          <Text style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: spacing.lg,
          }}>Use your current location to see available leads in your area.</Text>
          <Pressable
            onPress={handleSetHomeLocation}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{
              fontSize: 15,
              fontWeight: '700',
              color: colors.buttonText,
            }}>Use Current Location</Text>
          </Pressable>
        </Animated.View>
      );
    }

    if (profileStatus && profileStatus.hasLocation && !profileStatus.isInServiceArea) {
      return (
        <Animated.View 
          entering={FadeIn.delay(200).duration(400)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: withAlpha(colors.info, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="map" size={36} color={colors.info} />
          </View>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.textPrimary,
            marginBottom: spacing.xs,
          }}>Service coming soon</Text>
          <Text style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
          }}>WrenchGo isn't available in your area yet, but we're expanding! We'll notify you when service opens near you.</Text>
        </Animated.View>
      );
    }

    return <LeadsEmptyState filter={filter} onEnableLocation={handleSetHomeLocation} />;
  };

  const renderFooter = () => {
    if (!hasMore || loading) return null;
    return (
      <Pressable
        onPress={loadMore}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          paddingVertical: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderRadius: radius.xl,
          alignItems: 'center',
          ...shadows.sm,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        }}>Load More</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.bg,
      }}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.5,
            marginBottom: spacing.md,
          }}>Leads</Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(100).duration(300)}
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: 4,
            ...shadows.sm,
          }}
        >
          <FilterTab
            label="All"
            icon="list"
            isActive={filter === 'all'}
            onPress={() => setFilter('all')}
            count={summary?.all_count}
          />
          <FilterTab
            label="Nearby"
            icon="location"
            isActive={filter === 'nearby'}
            onPress={() => setFilter('nearby')}
            count={summary?.nearby_count}
          />
          <FilterTab
            label="Quoted"
            icon="document-text"
            isActive={filter === 'quoted'}
            onPress={() => setFilter('quoted')}
            count={summary?.quoted_count}
          />
        </Animated.View>
      </View>

      {summary && (
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <StatBadge
            icon="briefcase"
            value={summary.all_count || 0}
            label="Available"
            color={colors.primary}
          />
          <StatBadge
            icon="location"
            value={summary.nearby_count || 0}
            label="Nearby"
            color={colors.success}
          />
          <StatBadge
            icon="document-text"
            value={summary.quoted_count || 0}
            label="Quoted"
            color={colors.warning}
          />
        </Animated.View>
      )}

      {showLocationBanner && (
        <LocationBanner
          type="no-location"
          onSetLocation={handleSetHomeLocation}
          loading={settingLocation}
        />
      )}

      {showServiceAreaBanner && (
        <LocationBanner type="not-in-area" />
      )}

      {error && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          style={{
            backgroundColor: colors.errorBg,
            padding: spacing.md,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            borderRadius: radius.lg,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
        </Animated.View>
      )}

      {loading && leads.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <LeadCardSkeleton />
          <LeadCardSkeleton />
          <LeadCardSkeleton />
        </View>
      ) : (
        <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_LEADS_LIST} style={{ flex: 1 }}>
          <FlatList
            data={leads}
            renderItem={renderLeadCard}
            keyExtractor={(item) => item.job_id}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxxl,
              flexGrow: leads.length === 0 ? 1 : undefined,
            }}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={loading && leads.length > 0}
                onRefresh={() => {
                  endReachedLockRef.current = false;
                  refetch();
                }}
                tintColor={colors.primary}
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            showsVerticalScrollIndicator={false}
          />
        </WalkthroughTarget>
      )}
    </View>
  );
}
