import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetMetrics, AdminMetrics } from '../../src/lib/admin';

const { width } = Dimensions.get('window');

export default function AdminMetricsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(14);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetMetrics(undefined, periodDays);
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useFocusEffect(useCallback(() => { fetchMetrics(); }, [fetchMetrics]));

  const StatCard = ({ label, value, color, suffix = '' }: { label: string; value: number | string; color?: string; suffix?: string }) => (
    <View style={{ 
      backgroundColor: colors.surface, 
      borderRadius: 12, 
      padding: spacing.md, 
      flex: 1,
      marginHorizontal: 4,
      marginBottom: spacing.sm,
    }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: color || colors.accent }}>{value}{suffix}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{label}</Text>
    </View>
  );

  const MiniChart = ({ data, color }: { data: Array<{ date: string; count: number }>; color: string }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    const chartWidth = width - spacing.lg * 2 - spacing.md * 2;
    const barWidth = Math.max((chartWidth / data.length) - 2, 4);
    
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, marginTop: spacing.sm }}>
        {data.map((d, i) => (
          <View 
            key={i} 
            style={{ 
              width: barWidth, 
              height: Math.max((d.count / max) * 50, 2), 
              backgroundColor: color,
              marginHorizontal: 1,
              borderRadius: 2,
            }} 
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Metrics</Text>
        <TouchableOpacity onPress={fetchMetrics}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Time Period
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        {[7, 14, 30].map(days => (
          <TouchableOpacity
            key={days}
            onPress={() => setPeriodDays(days)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 20,
              backgroundColor: periodDays === days ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: periodDays === days ? colors.accent : colors.border,
              marginRight: spacing.sm,
            }}
          >
            <Text style={{ color: periodDays === days ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{days} days</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {metrics && (
          <>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Totals</Text>
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
              <StatCard label="Support Tickets" value={metrics.totals.support_tickets} color="#8B5CF6" />
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Rates</Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              <StatCard label="Quotes/Job" value={metrics.rates.quotes_per_job} />
              <StatCard label="Acceptance" value={metrics.rates.acceptance_rate} suffix="%" color="#3B82F6" />
            </View>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              <StatCard label="Completion" value={metrics.rates.completion_rate} suffix="%" color="#10B981" />
              <StatCard label="Dispute Rate" value={metrics.rates.dispute_rate} suffix="%" color="#EF4444" />
            </View>
            <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
              <StatCard label="Refund Rate" value={metrics.rates.refund_rate} suffix="%" color="#F59E0B" />
              <StatCard label="Tickets/Job" value={metrics.rates.tickets_per_job} color="#8B5CF6" />
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Jobs Created (Daily)</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg }}>
              <MiniChart data={metrics.daily_jobs_created} color={colors.accent} />
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Jobs Completed (Daily)</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg }}>
              <MiniChart data={metrics.daily_jobs_completed} color="#10B981" />
            </View>

            {metrics.decline_reasons && metrics.decline_reasons.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Top Decline Reasons</Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                  {metrics.decline_reasons.slice(0, 5).map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                      <Text style={{ color: colors.textPrimary, flex: 1 }}>{r.reason || 'Unknown'}</Text>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{r.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
