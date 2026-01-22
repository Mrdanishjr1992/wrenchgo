import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetMetrics, AdminMetrics } from '../../src/lib/admin';
import { useAdminScope, useAdminHubs } from '../../src/lib/admin-filters';
import { 
  AdminHeader, 
  HubSelector,
  AdminLoadingState, 
  AdminEmptyState, 
  AdminErrorState,
} from '../../components/admin/AdminFilterComponents';
import { ThemedText } from '../../src/ui/components/ThemedText';

export default function AdminMetricsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scope = useAdminScope();
  const { hubs, loading: hubsLoading } = useAdminHubs();
  
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hubFilter, setHubFilter] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(14);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const effectiveHubId = scope.isSuper ? hubFilter : scope.hubId;
      const data = await adminGetMetrics(effectiveHubId || undefined, periodDays);
      setMetrics(data);
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
      setError(err?.message ?? 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hubFilter, periodDays, scope.hubId, scope.isSuper]);

  useFocusEffect(useCallback(() => { 
    if (!scope.loading) fetchMetrics(); 
  }, [fetchMetrics, scope.loading]));

  const onRefresh = () => { setRefreshing(true); fetchMetrics(); };

  const StatCard = ({ label, value, color }: { label: string; value: number | string; color?: string }) => (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginHorizontal: 4 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: color || colors.accent }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );

  if (scope.loading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Metrics" onBack={() => router.back()} />
        <AdminLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Metrics" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminErrorState message={error} onRetry={fetchMetrics} />
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <AdminHeader title="Metrics" onBack={() => router.back()} onRefresh={onRefresh} />
        <AdminEmptyState icon="analytics-outline" title="No metrics available" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <AdminHeader title="Metrics" onBack={() => router.back()} onRefresh={onRefresh} />

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {scope.isSuper && !hubsLoading && (
          <HubSelector
            hubs={hubs}
            selectedHubId={hubFilter}
            onSelect={(id) => { setHubFilter(id); setLoading(true); }}
          />
        )}
        
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[7, 14, 30].map(days => (
            <TouchableOpacity
              key={days}
              onPress={() => { setPeriodDays(days); setLoading(true); }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: periodDays === days ? colors.accent : colors.surface,
                borderWidth: 1,
                borderColor: periodDays === days ? colors.accent : colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: periodDays === days ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{days}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ThemedText variant="caption" style={{ marginBottom: spacing.sm, fontWeight: '700' }}>TOTALS</ThemedText>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard label="Jobs Created" value={metrics.totals.jobs_created} />
          <StatCard label="Jobs Completed" value={metrics.totals.jobs_completed} color="#10B981" />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard label="Quotes" value={metrics.totals.quotes} />
          <StatCard label="Accepted" value={metrics.totals.accepted} color="#3B82F6" />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
          <StatCard label="Disputes" value={metrics.totals.disputes} color="#EF4444" />
          <StatCard label="Support" value={metrics.totals.support_tickets} color="#8B5CF6" />
        </View>

        <ThemedText variant="caption" style={{ marginBottom: spacing.sm, fontWeight: '700' }}>RATES</ThemedText>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard label="Quotes/Job" value={metrics.rates.quotes_per_job.toFixed(1)} />
          <StatCard label="Acceptance" value={`${metrics.rates.acceptance_rate}%`} color="#3B82F6" />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard label="Completion" value={`${metrics.rates.completion_rate}%`} color="#10B981" />
          <StatCard label="Dispute Rate" value={`${metrics.rates.dispute_rate}%`} color="#EF4444" />
        </View>
      </ScrollView>
    </View>
  );
}
