import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetHubHealth, HubHealth } from '../../../src/lib/admin';

export default function AdminHubDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [health, setHealth] = useState<HubHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(14);

  const fetchHealth = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await adminGetHubHealth(id, periodDays);
      setHealth(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [id, periodDays]);

  useFocusEffect(useCallback(() => { fetchHealth(); }, [fetchHealth]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!health) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Hub not found</Text>
      </View>
    );
  }

  const StatCard = ({ label, value, color, suffix = '' }: { label: string; value: number | string | null; color?: string; suffix?: string }) => (
    <View style={{ 
      backgroundColor: colors.surface, 
      borderRadius: 12, 
      padding: spacing.md, 
      flex: 1,
      marginHorizontal: 4,
      marginBottom: spacing.sm,
    }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: color || colors.textPrimary }}>{value ?? '-'}{value !== null ? suffix : ''}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{label}</Text>
    </View>
  );

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{health.hub_name}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Hub Health</Text>
        </View>
        <TouchableOpacity onPress={fetchHealth}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
        {[7, 14, 30].map(days => (
          <TouchableOpacity
            key={days}
            onPress={() => setPeriodDays(days)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: 8,
              backgroundColor: periodDays === days ? colors.accent : colors.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: periodDays === days ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{days}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {/* Health Score & Expansion Status */}
        <View style={{ 
          backgroundColor: colors.surface, 
          borderRadius: 16, 
          padding: spacing.lg, 
          marginBottom: spacing.lg,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 48, fontWeight: '900', color: getHealthColor(health.health_score) }}>{health.health_score}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Health Score</Text>
          
          <View style={{ 
            marginTop: spacing.lg, 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.md, 
            borderRadius: 8,
            backgroundColor: health.can_expand ? '#10B98120' : '#EF444420',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={health.can_expand ? 'checkmark-circle' : 'close-circle'} 
                size={20} 
                color={health.can_expand ? '#10B981' : '#EF4444'} 
              />
              <Text style={{ 
                marginLeft: spacing.sm, 
                fontWeight: '700', 
                color: health.can_expand ? '#10B981' : '#EF4444' 
              }}>
                {health.can_expand ? 'Ready to Expand' : 'Not Ready to Expand'}
              </Text>
            </View>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Activity</Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard label="Jobs Requested" value={health.jobs_requested} />
          <StatCard label="Jobs Completed" value={health.jobs_completed} color="#10B981" />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
          <StatCard label="Avg Jobs/Day" value={health.avg_jobs_per_day} />
          <StatCard label="Active Mechanics" value={health.active_mechanics} color="#3B82F6" />
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Quality</Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard 
            label="Completion Rate" 
            value={health.completion_rate} 
            suffix="%" 
            color={health.completion_rate >= 95 ? '#10B981' : health.completion_rate >= 80 ? '#F59E0B' : '#EF4444'} 
          />
          <StatCard 
            label="Avg Response (min)" 
            value={health.avg_response_minutes} 
            color={health.avg_response_minutes && health.avg_response_minutes <= 10 ? '#10B981' : '#F59E0B'} 
          />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
          <StatCard label="Disputes" value={health.disputes} color={health.disputes > 0 ? '#EF4444' : colors.textPrimary} />
          <StatCard label="Support Tickets" value={health.support_tickets} color={health.support_tickets > 0 ? '#8B5CF6' : colors.textPrimary} />
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Thresholds</Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <StatCard 
            label="Disputes per 40" 
            value={health.disputes_per_40_completed} 
            color={health.disputes_per_40_completed <= 1 ? '#10B981' : '#EF4444'} 
          />
          <StatCard 
            label="Tickets per Job" 
            value={health.tickets_per_job} 
            color={health.tickets_per_job <= 0.15 ? '#10B981' : '#F59E0B'} 
          />
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Configuration</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary }}>Active Radius</Text>
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{health.hub_config.active_radius_miles} mi</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary }}>Invite Only</Text>
            <Text style={{ color: health.hub_config.invite_only ? '#F59E0B' : colors.textPrimary, fontWeight: '600' }}>
              {health.hub_config.invite_only ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary }}>Auto Expand</Text>
            <Text style={{ color: health.hub_config.auto_expand_enabled ? '#10B981' : colors.textPrimary, fontWeight: '600' }}>
              {health.hub_config.auto_expand_enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Expansion Criteria */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm }}>Expansion Criteria</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
          <CriteriaRow label="8+ jobs/day avg" met={health.avg_jobs_per_day >= 8} />
          <CriteriaRow label="95%+ completion rate" met={health.completion_rate >= 95} />
          <CriteriaRow label="Response <= 10 min" met={health.avg_response_minutes === null || health.avg_response_minutes <= 10} />
          <CriteriaRow label="Disputes <= 1 per 40" met={health.disputes_per_40_completed <= 1} />
          <CriteriaRow label="Tickets/job <= 0.15" met={health.tickets_per_job <= 0.15} />
        </View>
      </ScrollView>
    </View>
  );
}

function CriteriaRow({ label, met }: { label: string; met: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Ionicons name={met ? 'checkmark-circle' : 'close-circle'} size={18} color={met ? '#10B981' : '#EF4444'} />
      <Text style={{ marginLeft: spacing.sm, color: colors.textPrimary }}>{label}</Text>
    </View>
  );
}
