import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  FlatList,
  Image,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text, glassCard } from "../../../src/ui/theme";
import { LinearGradient } from "expo-linear-gradient";

type Job = {
  id: string;
  title: string;
  status: string;
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


const statusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return colors.accent;
  if (s === "work_in_progress") return colors.brand;
  if (s === "completed") return colors.success;
  if (s === "searching") return colors.textMuted;
  return colors.textSecondary;
};

const StatusPill = ({ status }: { status: string }) => {
  const c = statusColor(status);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: c + "22",
        borderWidth: 1,
        borderColor: c + "55",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>
        {(status || "unknown").toUpperCase()}
      </Text>
    </View>
  );
};

const StatCard = ({
  title,
  value,
  onPress,
}: {
  title: string;
  value: string;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={{
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    }}
  >
    <Text style={text.muted}>{title}</Text>
    <Text style={{ ...text.title, fontSize: 22 }}>{value}</Text>
    {onPress ? (
      <Text style={{ color: colors.accent, fontWeight: "900" }}>Open →</Text>
    ) : null}
  </Pressable>
);

export default function CustomerHome() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fullName, setFullName] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [unread, setUnread] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = userData.user?.id;
      if (!userId) return;

      // profile name
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) throw pErr;
      setFullName(p?.full_name ?? "");

      // jobs
            const { data:j, jErr } = await supabase
      .from("jobs")
      .select(`
        id,title,status,created_at,preferred_time,vehicle_id,
        vehicle:vehicles(id,year,make,model,nickname)
      `)
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

      if (jErr) throw jErr;
      setJobs((j as Job[]) ?? []);

      // vehicles
      const { data: v, error: vErr } = await supabase
        .from("vehicles")
        .select("id,year,make,model,nickname")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });

        if (vErr) throw vErr;
        setVehicles((v as Vehicle[]) ?? []);

      // unread messages (from notifications table)
      const { count, error: nErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (nErr) throw nErr;
      setUnread(count ?? 0);
    } catch (e: any) {
      Alert.alert("Home error", e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const activeJobs = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() !== "completed"),
    [jobs]
  );

  const preview = useMemo(() => activeJobs.slice(0, 3), [activeJobs]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Hero */}
    <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <View
          style={{
            width: 280,
            height: 280,
            borderRadius: 20,
            //backgroundColor: "transparent", // 🔑 important
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../../assets/logo.png")}
            style={{
              width: "100%",
              height: "100%",
            }}
            resizeMode="contain"
          />
        </View>

          <Text style={{ ...text.title, marginTop: spacing.md }}>WrenchGo</Text>
          <Text style={{ ...text.muted, marginTop: 6 }}>
            {fullName ? `Hey, ${fullName.split(" ")[0]} 👋` : "Request a mechanic in minutes"}
          </Text>
        </View>

        {/* Primary actions */}
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/explore")}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: "#000" }}>REQUEST A MECHANIC</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/jobs")}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.textPrimary }}>VIEW MY JOBS</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
          <StatCard
            title="Active Jobs"
            value={String(activeJobs.length)}
            onPress={() => router.push("/(customer)/(tabs)/jobs")}
          />
          <StatCard
            title="Unread Messages"
            value={String(unread)}
            onPress={() =>
              router.push("/(customer)/(tabs)/messages" as any) // if you used messages tab
            }
          />
        </View>
        {/* My Garage */}
        <View style={{ marginTop: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={text.section}>My Garage</Text>

            <Pressable onPress={() => router.push("/(customer)/garage/add" as any)}>
              <Text style={{ color: colors.accent, fontWeight: "900" }}>Add</Text>
            </Pressable>
          </View>

          {vehicles.length === 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={text.muted}>No vehicles added yet.</Text>
              <Text style={{ marginTop: 6, ...text.body }}>
                Add your car to get faster, better quotes.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {vehicles.slice(0, 3).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push(`/(customer)/garage/${v.id}` as any)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={text.section}>
                    {v.year} {v.make} {v.model}
                  </Text>

                  {v.nickname ? (
                    <Text style={text.muted}>“{v.nickname}”</Text>
                  ) : null}
                </Pressable>
              ))}

              {vehicles.length > 3 ? (
                <Pressable onPress={() => router.push("/(customer)/garage" as any)}>
                  <Text style={{ color: colors.accent, fontWeight: "900" }}>
                    View all vehicles →
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {/* Active jobs preview */}
       

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={text.section}>Active Jobs</Text>
            <Pressable onPress={() => router.push("/(customer)/(tabs)/jobs")}>
              <Text style={{ color: colors.accent, fontWeight: "900" }}>See all</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={{ marginTop: spacing.md, alignItems: "center" }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
            </View>
          ) : preview.length === 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={text.muted}>No active jobs yet.</Text>
              <Text style={{ marginTop: 6, ...text.body }}>
                Tap “Request a mechanic” to start your first job.
              </Text>
            </View>
          ) : (
            <FlatList
              style={[glassCard, { padding: spacing.md }]}
              data={preview}
              keyExtractor={(j) => j.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/(customer)/job/${item.id}`)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 8,
                  }}
                >
                  <Text style={text.section}>{item.title}</Text>
                  <StatusPill status={item.status} />
                  <Text style={text.body}>Preferred: {item.preferred_time ?? "—"}</Text>
                  <Text style={text.muted}>
                    Created {new Date(item.created_at).toLocaleString()}
                  </Text>
                </Pressable>
              )}
            /> 
          )}
      </ScrollView>
    </View>
  );
}
