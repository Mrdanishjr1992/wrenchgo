import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";

type Contract = {
  id: string;
  job_id: string;
  customer_id: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  location_address: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [jobsById, setJobsById] = useState<Record<string, JobRow>>({});
  const [customersById, setCustomersById] = useState<Record<string, ProfileRow>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }

      // Upcoming (and recently scheduled) contracts
      const nowIso = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(); // 6h buffer

      const { data: contractRows, error: contractErr } = await supabase
        .from("job_contracts")
        .select("id, job_id, customer_id, status, scheduled_start, scheduled_end")
        .eq("mechanic_id", user.id)
        .is("deleted_at", null)
        .gte("scheduled_start", nowIso)
        .order("scheduled_start", { ascending: true });

      if (contractErr) throw contractErr;

      const safeContracts: Contract[] = (contractRows ?? []).map((c: any) => ({
        id: c.id,
        job_id: c.job_id,
        customer_id: c.customer_id,
        status: c.status,
        scheduled_start: c.scheduled_start,
        scheduled_end: c.scheduled_end,
      }));

      setContracts(safeContracts);

      const jobIds = Array.from(new Set(safeContracts.map((c) => c.job_id).filter(Boolean)));
      const customerIds = Array.from(
        new Set(safeContracts.map((c) => c.customer_id).filter(Boolean))
      );

      if (jobIds.length > 0) {
        const { data: jobRows, error: jobErr } = await supabase
          .from("jobs")
          .select("id, title, status, location_address")
          .in("id", jobIds);
        if (jobErr) throw jobErr;

        const nextJobs: Record<string, JobRow> = {};
        for (const j of jobRows ?? []) {
          nextJobs[(j as any).id] = {
            id: (j as any).id,
            title: (j as any).title ?? null,
            status: (j as any).status,
            location_address: (j as any).location_address ?? null,
          };
        }
        setJobsById(nextJobs);
      } else {
        setJobsById({});
      }

      if (customerIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);
        if (profileErr) throw profileErr;

        const nextCustomers: Record<string, ProfileRow> = {};
        for (const p of profileRows ?? []) {
          nextCustomers[(p as any).id] = {
            id: (p as any).id,
            full_name: (p as any).full_name ?? null,
          };
        }
        setCustomersById(nextCustomers);
      } else {
        setCustomersById({});
      }
    } catch (e: any) {
      console.error("Schedule load error:", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={{ padding: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12, color: theme.textSecondary }}>Loading schedule…</Text>
        </View>
      );
    }

    if (contracts.length === 0) {
      return (
        <View style={{ padding: 24 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>No upcoming bookings</Text>
          <Text style={{ marginTop: 8, color: theme.textSecondary }}>
            When customers accept your quotes and select a time window, your upcoming jobs will appear here.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ padding: 16, gap: 12 }}>
        {contracts.map((c) => {
          const job = jobsById[c.job_id];
          const customer = customersById[c.customer_id];

          return (
            <View
              key={c.id}
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>
                {job?.title || "Job"}
              </Text>
              <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                Customer: {customer?.full_name || "Customer"}
              </Text>
              <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                {formatDateTime(c.scheduled_start)} → {formatDateTime(c.scheduled_end)}
              </Text>
              {!!job?.location_address && (
                <Text style={{ color: theme.textSecondary, marginTop: 4 }}>{job.location_address}</Text>
              )}
              <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                Contract status: {c.status} · Job status: {job?.status || "—"}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }, [contracts, jobsById, customersById, loading, theme]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>Schedule</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 6 }}>
          Upcoming bookings pulled from accepted quotes & contracts. Double-booking is blocked at the database layer.
        </Text>
      </View>
      {content}
    </ScrollView>
  );
}
