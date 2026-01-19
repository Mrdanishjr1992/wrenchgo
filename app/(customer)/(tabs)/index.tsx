import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { useTheme } from "../../../src/ui/theme-context";
import { supabase } from "../../../src/lib/supabase";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  preferred_time: string | null;
};

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SectionHeader({ 
  overline, 
  title, 
  action, 
  onAction 
}: { 
  overline?: string; 
  title: string; 
  action?: string; 
  onAction?: () => void;
}) {
  const { colors, spacing } = useTheme();
  
  return (
    <View style={{ 
      flexDirection: "row", 
      alignItems: "flex-end", 
      justifyContent: "space-between",
      marginBottom: spacing.md,
    }}>
      <View>
        {overline && (
          <Text style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 4,
          }}>{overline}</Text>
        )}
        <Text style={{
          fontSize: 20,
          fontWeight: "800",
          color: colors.textPrimary,
          letterSpacing: -0.3,
        }}>{title}</Text>
      </View>
      {action && onAction && (
        <Pressable 
          onPress={onAction}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ 
            fontSize: 14, 
            fontWeight: "700", 
            color: colors.primary,
          }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatCard({ 
  icon, 
  iconBg, 
  iconColor, 
  label, 
  value, 
  subtitle, 
  onPress,
  highlight,
  delay = 0,
}: { 
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View 
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={{ flex: 1 }}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          ...shadows.sm,
        }]}
      >
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          gap: 8,
          marginBottom: spacing.md,
        }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
        </View>
        
        <Text style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.textMuted,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 4,
        }}>{label}</Text>
        
        <Text style={{
          fontSize: 36,
          fontWeight: "800",
          color: highlight ? iconColor : colors.textPrimary,
          letterSpacing: -1,
          lineHeight: 40,
        }}>{value}</Text>
        
        <Text style={{
          fontSize: 13,
          color: colors.textMuted,
          marginTop: 4,
        }}>{subtitle}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function QuickHelpItem({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  urgent,
  onPress,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  urgent?: boolean;
  onPress: () => void;
  delay?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: urgent ? iconBg : "transparent",
        }]}
      >
        <View style={{
          width: 44,
          height: 44,
          borderRadius: radius.lg,
          backgroundColor: urgent ? colors.surface : iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 15,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: 2,
          }}>{title}</Text>
          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
          }}>{subtitle}</Text>
        </View>
        
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.surface2,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function VehicleCard({
  vehicle,
  onPress,
  delay = 0,
}: {
  vehicle: Vehicle;
  onPress: () => void;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows } = useTheme();
  const scale = useSharedValue(1);

  const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${encodeURIComponent(
    vehicle.model.split(" ")[0] || vehicle.model
  )}&make=${encodeURIComponent(vehicle.make)}&modelYear=${encodeURIComponent(
    String(vehicle.year)
  )}&angle=29`;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 80,
          height: 52,
          borderRadius: radius.lg,
          backgroundColor: colors.surface2,
          overflow: "hidden",
        }}>
          <Image 
            source={{ uri: carImageUrl }} 
            style={{ width: "100%", height: "100%" }} 
            resizeMode="contain" 
          />
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 15,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: 2,
          }}>{vehicle.year} {vehicle.make}</Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
          }}>{vehicle.model}</Text>
          {vehicle.nickname && (
            <Text style={{
              fontSize: 12,
              color: colors.textMuted,
              fontStyle: "italic",
              marginTop: 2,
            }}>"{vehicle.nickname}"</Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyGarage({ onAdd }: { onAdd: () => void }) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(200).duration(400)}>
      <AnimatedPressable
        onPress={onAdd}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          backgroundColor: withAlpha(colors.primary, 0.05),
          borderWidth: 2,
          borderColor: withAlpha(colors.primary, 0.15),
          borderStyle: "dashed",
          borderRadius: radius.xl,
          padding: spacing.xl,
          alignItems: "center",
          gap: spacing.sm,
        }]}
      >
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: withAlpha(colors.primary, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.xs,
        }}>
          <Ionicons name="car-sport" size={28} color={colors.primary} />
        </View>
        
        <Text style={{
          fontSize: 17,
          fontWeight: "700",
          color: colors.textPrimary,
        }}>Add your first vehicle</Text>
        
        <Text style={{
          fontSize: 14,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 20,
        }}>Get faster quotes and personalized service recommendations</Text>
        
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: spacing.sm,
          backgroundColor: colors.primary,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
        }}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={{
            fontSize: 14,
            fontWeight: "700",
            color: colors.white,
          }}>Add Vehicle</Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  
  const shimmerStyle = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
    borderRadius: radius.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg }}>
      <View style={{ paddingTop: insets.top + spacing.lg, marginBottom: spacing.xl }}>
        <View style={[shimmerStyle, { width: 120, height: 14, marginBottom: 8 }]} />
        <View style={[shimmerStyle, { width: 200, height: 32 }]} />
      </View>
      
      <View style={[shimmerStyle, { 
        height: 88, 
        borderRadius: radius.xl, 
        marginBottom: spacing.lg 
      }]} />
      
      <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
        <View style={[shimmerStyle, { flex: 1, height: 160, borderRadius: radius.xl }]} />
        <View style={[shimmerStyle, { flex: 1, height: 160, borderRadius: radius.xl }]} />
      </View>
      
      <View style={[shimmerStyle, { width: 100, height: 14, marginBottom: spacing.md }]} />
      <View style={[shimmerStyle, { height: 100, borderRadius: radius.xl, marginBottom: spacing.xl }]} />
      
      <View style={[shimmerStyle, { width: 80, height: 14, marginBottom: spacing.md }]} />
      <View style={{ gap: spacing.sm }}>
        <View style={[shimmerStyle, { height: 68 }]} />
        <View style={[shimmerStyle, { height: 68 }]} />
      </View>
    </View>
  );
}

export default function CustomerHome() {
  const router = useRouter();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [unread, setUnread] = useState(0);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = useMemo(() => (fullName.split(" ")[0] || "").trim(), [fullName]);

  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      const s = (j.status || "").toLowerCase();
      return s !== "completed" && s !== "canceled";
    });
  }, [jobs]);

  const bootstrapUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const uid = data.session?.user?.id ?? null;
      if (!uid) {
        router.replace("/(auth)/sign-in");
        return;
      }
      setCustomerId(uid);
    } catch (e: any) {
      console.warn("bootstrapUser error:", e?.message ?? e);
      router.replace("/(auth)/sign-in");
    }
  }, [router]);

  useEffect(() => {
    bootstrapUser();
  }, [bootstrapUser]);

  const fetchData = useCallback(async () => {
    if (!customerId) return;
    try {
      const [jobsRes, vehiclesRes, profileRes, unreadRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id,title,status,created_at,preferred_time")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicles")
          .select("id,year,make,model,nickname")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", customerId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id, job_id, jobs!inner(customer_id)", { count: "exact", head: true })
          .eq("jobs.customer_id", customerId)
          .is("read_at", null)
          .neq("sender_id", customerId),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (profileRes.error) throw profileRes.error;
      if (unreadRes.error) throw unreadRes.error;

      setJobs((jobsRes.data as Job[]) ?? []);
      setVehicles((vehiclesRes.data as Vehicle[]) ?? []);
      setFullName(profileRes.data?.full_name ?? "");
      setUnread(unreadRes.count ?? 0);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    fetchData();
  }, [customerId, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  if (loading) {
    return <LoadingSkeleton />;
  }

  const greeting = firstName ? `Hey, ${firstName}` : "Welcome back";
  const timeOfDay = new Date().getHours();
  const greetingPrefix = timeOfDay < 12 ? "Good morning" : timeOfDay < 18 ? "Good afternoon" : "Good evening";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
          />
        }
      >
        {/* HEADER SECTION */}
        <View style={{ 
          paddingHorizontal: spacing.lg, 
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.lg,
        }}>
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              marginBottom: 4,
            }}>
              {greetingPrefix} {firstName ? `${firstName}` : ""}
            </Text>
            <Text style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.textPrimary,
              letterSpacing: -0.5,
            }}>
              {new Date().toLocaleDateString(undefined, { 
                weekday: "long", 
                month: "short", 
                day: "numeric" 
              })}
            </Text>
          </Animated.View>
        </View>

        {/* PRIMARY CTA - Request a Mechanic */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.CUSTOMER_POST_JOB_CTA}>
            <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
              <AnimatedPressable
                onPress={() => router.push("/explore")}
                onPressIn={() => { ctaScale.value = withSpring(0.98, { damping: 15 }); }}
                onPressOut={() => { ctaScale.value = withSpring(1, { damping: 15 }); }}
                style={[ctaAnimatedStyle, {
                  backgroundColor: colors.accent,
                  borderRadius: radius.xxl,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  ...shadows.lg,
                }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: withAlpha(colors.white, 0.2),
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons name="construct" size={26} color={colors.white} />
                  </View>
                  <View>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: colors.buttonText,
                      marginBottom: 2,
                    }}>Request a Mechanic</Text>
                    <Text style={{
                      fontSize: 14,
                      color: withAlpha(colors.buttonText, 0.8),
                    }}>Get help with your car today</Text>
                  </View>
                </View>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: withAlpha(colors.white, 0.2),
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </View>
              </AnimatedPressable>
            </Animated.View>
          </WalkthroughTarget>
        </View>

        {/* STATS SECTION */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <StatCard
              icon="briefcase-outline"
              iconBg={colors.primaryBg}
              iconColor={colors.primary}
              label="Active Jobs"
              value={activeJobs.length}
              subtitle={activeJobs.length === 0 ? "No active jobs" : "Tap to view"}
              onPress={() => router.push("/(customer)/(tabs)/jobs" as any)}
              delay={200}
            />
            <StatCard
              icon={unread > 0 ? "mail-unread" : "mail-outline"}
              iconBg={unread > 0 ? colors.errorBg : colors.primaryBg}
              iconColor={unread > 0 ? colors.error : colors.primary}
              label="Messages"
              value={unread}
              subtitle={unread === 0 ? "All caught up" : "Unread messages"}
              onPress={() => router.push("/(customer)/(tabs)/inbox" as any)}
              highlight={unread > 0}
              delay={300}
            />
          </View>
        </View>

        {/* MY GARAGE SECTION */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <SectionHeader
            overline="Your vehicles"
            title="My Garage"
            action="+ Add"
            onAction={() => router.push("/(customer)/garage/add" as any)}
          />
          
          {vehicles.length === 0 ? (
            <EmptyGarage onAdd={() => router.push("/(customer)/garage/add" as any)} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {vehicles.slice(0, 3).map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onPress={() => router.push({ 
                    pathname: "/(customer)/garage/[id]" as any, 
                    params: { id: vehicle.id } 
                  })}
                  delay={400 + index * 100}
                />
              ))}
              {vehicles.length > 3 && (
                <Pressable 
                  onPress={() => router.push("/(customer)/garage" as any)}
                  style={{ paddingVertical: spacing.sm }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.primary,
                    textAlign: "center",
                  }}>View all {vehicles.length} vehicles</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* CAR CARE LIBRARY SECTION */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SectionHeader
            overline="Learn first"
            title="Car Care Library"
            action="See all"
            onAction={() => router.push("/(customer)/education/index" as any)}
          />

          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.sm,
            ...shadows.sm,
          }}>
            <QuickHelpItem
              icon="warning"
              iconBg={colors.errorBg}
              iconColor={colors.error}
              title="Car won't start?"
              subtitle="Learn common causes & what to do"
              urgent
              onPress={() => router.push({ pathname: "/(customer)/education/[slug]", params: { slug: "car-wont-start" } } as any)}
              delay={600}
            />

            <View style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: spacing.md,
            }} />

            <QuickHelpItem
              icon="speedometer"
              iconBg={colors.warningBg}
              iconColor={colors.warning}
              title="Check engine light on?"
              subtitle="Understand what it means"
              onPress={() => router.push({ pathname: "/(customer)/education/[slug]", params: { slug: "check-engine-light" } } as any)}
              delay={700}
            />

            <View style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: spacing.md,
            }} />

            <QuickHelpItem
              icon="build"
              iconBg={colors.successBg}
              iconColor={colors.success}
              title="Regular maintenance"
              subtitle="Keep your car running smoothly"
              onPress={() => router.push({ pathname: "/(customer)/education/[slug]", params: { slug: "regular-maintenance" } } as any)}
              delay={800}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
