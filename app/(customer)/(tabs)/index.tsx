import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../src/ui/theme-context";
import { supabase } from "../../../src/lib/supabase";
import { createCard } from "../../../src/ui/styles";

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

type EducationCard = {
  symptom_key: string;
  card_key: string;
  title: string | null;
  summary: string | null;
  is_it_safe: string | null;
  order_index: number | null;
};

type SymptomMapping = {
  symptom_key: string;
  symptom_label: string;
  category: string | null;
  risk_level: string | null;
  customer_explainer: string | null;
};

export default function CustomerHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [customerId, setCustomerId] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [unread, setUnread] = useState(0);
  const [fullName, setFullName] = useState("");
  const [educationCards, setEducationCards] = useState<EducationCard[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomMapping[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = useMemo(() => (fullName.split(" ")[0] || "").trim(), [fullName]);
  
  const card = useMemo(() => createCard(colors), [colors]);
  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      const s = (j.status || "").toLowerCase();
      return s !== "completed" && s !== "canceled";
    });
  }, [jobs]);

  const quickLabel = useMemo(() => {
    if (activeJobs.length === 0) return "No active jobs";
    if (activeJobs.length === 1) return "1 active job";
    return `${activeJobs.length} active jobs`;
  }, [activeJobs.length]);

  // --- Auth bootstrap: never sign-out here, just route if no session
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
      // If auth is temporarily unavailable, don't hard-kick repeatedly
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
      // Only show the full-screen spinner on first load
      setLoading((prev) => prev);

      const jobsQ = supabase
        .from("jobs")
        .select("id,title,status,created_at,preferred_time")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      const vehiclesQ = supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true });

      // ✅ profiles uses auth_id in your schema
      const profileQ = supabase
        .from("profiles")
        .select("full_name")
        .eq("auth_id", customerId)
        .maybeSingle();

      // ✅ messages unread = read_at IS NULL (and count should use head: true)
      const unreadQ = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", customerId)
        .is("read_at", null);

      // ✅ education_cards has NO id column
      const eduQ = supabase
        .from("education_cards")
        .select("symptom_key,card_key,title,summary,is_it_safe,order_index")
        .order("order_index", { ascending: true })
        .limit(6);

      // ✅ symptom_mappings has NO id column
      const symptomsQ = supabase
        .from("symptom_mappings")
        .select("symptom_key,symptom_label,category,risk_level,customer_explainer")
        .order("symptom_label", { ascending: true })
        .limit(8);

      const [jobsRes, vehiclesRes, profileRes, unreadRes, eduRes, symRes] = await Promise.all([
        jobsQ,
        vehiclesQ,
        profileQ,
        unreadQ,
        eduQ,
        symptomsQ,
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (profileRes.error) throw profileRes.error;
      if (unreadRes.error) throw unreadRes.error;
      if (eduRes.error) throw eduRes.error;
      if (symRes.error) throw symRes.error;

      setJobs((jobsRes.data as Job[]) ?? []);
      setVehicles((vehiclesRes.data as Vehicle[]) ?? []);
      setFullName(profileRes.data?.full_name ?? "");
      setUnread(unreadRes.count ?? 0);
      setEducationCards((eduRes.data as EducationCard[]) ?? []);
      setSymptoms((symRes.data as SymptomMapping[]) ?? []);
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

  const handleRequestMechanic = () => router.push("/(customer)/(tabs)/explore" as any);
  const handleViewJobs = () => router.push("/(customer)/(tabs)/jobs" as any);
  const handleViewInbox = () => router.push("/(customer)/(tabs)/inbox" as any);
  const handleAddVehicle = () => router.push("/(customer)/garage/add" as any);
  const handleViewGarage = () => router.push("/(customer)/garage" as any);
  const handleViewEducation = () => router.push("/(customer)/education" as any);

  const handleViewVehicle = (vehicleId: string) => {
    router.push({ pathname: "/(customer)/garage/[id]" as any, params: { id: vehicleId } });
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.accent, colors.accent + "58"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[card, styles.header, { paddingTop: insets.top }]}
    >
      <View style={styles.headerContent}>
        <View style={styles.headerTitleRow}>
          <Image source={require("../../../assets/wave.png")} style={styles.headerIcon} resizeMode="contain" />
          <Text style={styles.headerTitle}>
            {firstName ? `Hey, ${firstName} 👋` : "WrenchGo"}
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>{quickLabel}</Text>
      </View>
    </LinearGradient>
  );

  const renderQuickActions = () => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.quickActionsContainer}>
        <Pressable
          onPress={handleRequestMechanic}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
          ]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>REQUEST A MECHANIC</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleViewJobs}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
            VIEW MY JOBS
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          title="Active Jobs"
          value={String(activeJobs.length)}
          hint={activeJobs.length ? "Tap to view" : "Start one now"}
          onPress={handleViewJobs}
          colors={colors}
        />
        <StatCard
          title="Unread Messages"
          value={String(unread)}
          hint={unread ? "Check inbox" : "All caught up"}
          onPress={handleViewInbox}
          colors={colors}
        />
      </View>
    </View>
  );

  const renderGarageSection = () => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <SectionHeader
        title="My Garage"
        rightText="Add"
        onRightPress={handleAddVehicle}
        icon={require("../../../assets/garage.png")}
        colors={colors}
      />

      {vehicles.length === 0 ? (
        <EmptyGarageState onAddVehicle={handleAddVehicle} colors={colors} />
      ) : (
        <View style={styles.vehicleList}>
          {vehicles.slice(0, 3).map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onPress={() => handleViewVehicle(vehicle.id)}
              colors={colors}
            />
          ))}
          {vehicles.length > 3 && (
            <Pressable onPress={handleViewGarage}>
              <Text style={[styles.viewAllText, { color: colors.accent }]}>View all vehicles →</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  const renderCarCareTipsSection = () => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.decorativeCircle3} />
      <View style={styles.decorativeCircle4} />

      <SectionHeader
        title="Car Care Tips"
        rightText="View All"
        onRightPress={handleViewEducation}
        icon={require("../../../assets/garage.png")}
        colors={colors}
      />

      <Text style={[styles.sectionDescription, { color: colors.textPrimary }]}>
        Learn about common car issues and what to do
      </Text>

      {symptoms.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {symptoms.slice(0, 4).map((symptom) => (
            <SymptomCard
              key={symptom.symptom_key}
              symptom={symptom}
              onPress={handleViewEducation}
              colors={colors}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading car care tips...</Text>
        </View>
      )}
    </View>
  );

  const renderEducationSection = () => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.decorativeCircle5} />
      <View style={styles.decorativeCircle6} />

      <SectionHeader title="What to Know" rightText="See All" onRightPress={handleViewEducation} colors={colors} />

      <Text style={[styles.sectionDescription, { color: colors.textPrimary }]}>
        Educational guides to help you understand your car better
      </Text>

      {educationCards.length > 0 ? (
        <View style={styles.educationList}>
          {educationCards.slice(0, 3).map((eduCard) => (
            <EducationCardItem
              key={`${eduCard.symptom_key}:${eduCard.card_key}`}
              card={eduCard}
              onPress={handleViewEducation}
              colors={colors}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading educational content...</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {renderHeader()}
        <View style={{ padding: 16 }}>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>Loading…</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
              Fetching your jobs, garage, and tips.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
      {renderHeader()}
        {renderQuickActions()}
        {renderGarageSection()}
        {renderCarCareTipsSection()}
        {renderEducationSection()}
      </ScrollView>
    </View>
  );
}

function StatCard({
  title,
  value,
  hint,
  onPress,
  colors,
}: {
  title: string;
  value: string;
  hint: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.accent,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text style={[styles.statTitle, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statHint, { color: colors.textMuted }]}>{hint}</Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  rightText,
  onRightPress,
  icon,
  colors,
}: {
  title: string;
  rightText?: string;
  onRightPress?: () => void;
  icon?: any;
  colors: any;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && <Image source={icon} style={styles.sectionIcon} resizeMode="contain" />}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {rightText && onRightPress && (
        <Pressable onPress={onRightPress}>
          <Text style={[styles.sectionHeaderAction, { color: colors.accent }]}>{rightText}</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptyGarageState({ onAddVehicle, colors }: { onAddVehicle: () => void; colors: any }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No vehicles yet</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        Add your car to get faster, more accurate quotes.
      </Text>
      <Pressable onPress={onAddVehicle} style={[styles.emptyButton, { backgroundColor: colors.accent }]}>
        <Text style={styles.emptyButtonText}>ADD A VEHICLE</Text>
      </Pressable>
    </View>
  );
}

function VehicleCard({
  vehicle,
  onPress,
  colors,
}: {
  vehicle: Vehicle;
  onPress: () => void;
  colors: any;
}) {
  const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${encodeURIComponent(
    vehicle.model.split(" ")[0] || vehicle.model
  )}&make=${encodeURIComponent(vehicle.make)}&modelYear=${encodeURIComponent(
    String(vehicle.year)
  )}&angle=29`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.vehicleCard,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={[styles.vehicleImageContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Image source={{ uri: carImageUrl }} style={styles.vehicleImage} resizeMode="contain" />
      </View>
      <View style={styles.vehicleInfo}>
        <Text style={[styles.vehicleName, { color: colors.textPrimary }]}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.nickname ? (
          <Text style={[styles.vehicleNickname, { color: colors.textMuted }]}>
            “{vehicle.nickname}”
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SymptomCard({
  symptom,
  onPress,
  colors,
}: {
  symptom: SymptomMapping;
  onPress: () => void;
  colors: any;
}) {
  const risk = (symptom.risk_level || "low").toLowerCase();
  const riskColor = risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#10b981";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.symptomCard,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.symptomHeader}>
        <Text style={[styles.symptomTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {symptom.symptom_label}
        </Text>
        <View style={[styles.riskBadge, { backgroundColor: riskColor + "22" }]}>
          <Text style={[styles.riskText, { color: riskColor }]}>{risk.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={[styles.symptomDescription, { color: colors.textMuted }]} numberOfLines={3}>
        {symptom.customer_explainer || "Learn more about this symptom."}
      </Text>

      <View style={[styles.symptomFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.learnMoreText, { color: colors.accent }]}>Learn more →</Text>
      </View>
    </Pressable>
  );
}

function EducationCardItem({
  card,
  onPress,
  colors,
}: {
  card: EducationCard;
  onPress: () => void;
  colors: any;
}) {
  const safeText = (card.is_it_safe || "").toLowerCase();
  const safetyColor = safeText.includes("safe")
    ? "#10b981"
    : safeText.includes("not")
    ? "#ef4444"
    : "#f59e0b";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.educationCard,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.educationCardHeader}>
        <Text style={[styles.educationCardTitle, { color: colors.textPrimary }]}>
          {card.title || "Car Care Guide"}
        </Text>
        <View style={[styles.safetyIndicator, { backgroundColor: safetyColor }]} />
      </View>

      <Text style={[styles.educationCardDescription, { color: colors.textMuted }]} numberOfLines={2}>
        {card.summary || "Helpful info to understand what’s going on."}
      </Text>

      <View style={styles.educationCardTags}>
        <View style={[styles.tag, { backgroundColor: colors.accent + "15" }]}>
          <Text style={[styles.tagText, { color: colors.accent }]}>✅ What we'll check</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: safetyColor + "15" }]}>
          <Text style={[styles.tagText, { color: safetyColor }]}>🛟 Is it safe?</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: colors.textMuted + "15" }]}>
          <Text style={[styles.tagText, { color: colors.textMuted }]}>💵 How quotes work</Text>
        </View>
      </View>

      <View style={[styles.educationCardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.learnMoreText, { color: colors.accent }]}>Learn more →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: { gap: 4 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { width: 32, height: 32 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 14, color: "#fff", opacity: 0.9, marginLeft: 44 },

  scrollContent: { padding: 16, paddingBottom: 32 },

  section: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },

  decorativeCircle1: {
    position: "absolute",
    left: -60,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  decorativeCircle2: {
    position: "absolute",
    right: -50,
    bottom: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  decorativeCircle3: {
    position: "absolute",
    right: -60,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  decorativeCircle4: {
    position: "absolute",
    left: -50,
    top: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  decorativeCircle5: {
    position: "absolute",
    left: -60,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  decorativeCircle6: {
    position: "absolute",
    right: -50,
    bottom: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },

  quickActionsContainer: { gap: 12 },

  primaryButton: { borderRadius: 18, overflow: "hidden" },
  primaryButtonGradient: { paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", borderRadius: 18 },
  primaryButtonText: { fontWeight: "900", color: "#000", letterSpacing: 0.4, fontSize: 14 },

  secondaryButton: { borderWidth: 1, paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  secondaryButtonText: { fontWeight: "900", letterSpacing: 0.3, fontSize: 14 },

  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  statTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 25, fontWeight: "900" },
  statHint: { fontSize: 10, fontWeight: "700" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIcon: { width: 24, height: 24 },
  sectionTitle: { fontSize: 24, fontWeight: "900" },
  sectionHeaderAction: { fontWeight: "900", fontSize: 14 },

  sectionDescription: { fontSize: 16, fontWeight: "800", marginBottom: 12 },

  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  emptyText: { fontSize: 13, fontWeight: "600" },
  emptyButton: { marginTop: 12, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  emptyButtonText: { fontWeight: "900", color: "#000", fontSize: 13 },

  vehicleList: { gap: 12, marginTop: 8 },
  vehicleCard: { borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  vehicleImageContainer: {
    width: 80,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  vehicleImage: { width: "100%", height: "100%" },
  vehicleInfo: { flex: 1, gap: 4 },
  vehicleName: { fontSize: 16, fontWeight: "800" },
  vehicleNickname: { fontSize: 13, fontWeight: "600" },
  viewAllText: { fontWeight: "900", fontSize: 14, marginTop: 4 },

  horizontalScrollContent: { gap: 12, marginTop: 8, paddingRight: 16 },
  symptomCard: { width: 280, borderRadius: 14, borderWidth: 1, padding: 12 },
  symptomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  symptomTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  riskText: { fontSize: 10, fontWeight: "900" },
  symptomDescription: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginBottom: 8 },
  symptomFooter: { paddingTop: 8, borderTopWidth: 1 },
  learnMoreText: { fontWeight: "800", fontSize: 12 },

  educationList: { gap: 12, marginTop: 8 },
  educationCard: { borderRadius: 14, borderWidth: 1, padding: 12 },
  educationCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  educationCardTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  safetyIndicator: { width: 10, height: 10, borderRadius: 5 },
  educationCardDescription: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginBottom: 8 },
  educationCardTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  tagText: { fontSize: 11, fontWeight: "700" },
  educationCardFooter: { paddingTop: 8, borderTopWidth: 1 },
});
