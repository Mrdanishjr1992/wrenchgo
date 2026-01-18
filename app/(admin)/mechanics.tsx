import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetMechanics, AdminMechanic } from '../../src/lib/admin';

const STATUS_COLORS: Record<string, string> = {
  pending_verification: '#F59E0B',
  active: '#10B981',
  paused: '#6B7280',
  removed: '#EF4444',
};

const TIER_COLORS: Record<string, string> = {
  probation: '#F59E0B',
  standard: '#3B82F6',
  trusted: '#10B981',
};

export default function AdminMechanicsScreen() {
  const { colors } = useTheme();
  const [mechanics, setMechanics] = useState<AdminMechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchMechanics = useCallback(async () => {
    try {
      const data = await adminGetMechanics(statusFilter || undefined);
      setMechanics(data);
    } catch (error) {
      console.error('Error fetching mechanics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { fetchMechanics(); }, [fetchMechanics]));

  const onRefresh = () => { setRefreshing(true); fetchMechanics(); };

  const FilterButton = ({ value, label }: { value: string | null; label: string }) => (
    <TouchableOpacity
      onPress={() => setStatusFilter(statusFilter === value ? null : value)}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: statusFilter === value ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: statusFilter === value ? colors.accent : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ color: statusFilter === value ? '#fff' : colors.textSecondary, fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Mechanics</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Filter by Status
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        <FilterButton value={null} label="All" />
        <FilterButton value="pending_verification" label="Pending" />
        <FilterButton value="active" label="Active" />
        <FilterButton value="paused" label="Paused" />
        <FilterButton value="removed" label="Removed" />
      </ScrollView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {mechanics.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No mechanics found</Text>
        ) : (
          mechanics.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => router.push(`/(admin)/mechanics/${m.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: (STATUS_COLORS[m.verification_status] || colors.textSecondary) + '20',
                  }}>
                    <Text style={{ color: STATUS_COLORS[m.verification_status] || colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {(m.verification_status || 'unknown').toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>
                  {m.tier && (
                    <View style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: (TIER_COLORS[m.tier] || colors.textSecondary) + '20',
                    }}>
                      <Text style={{ color: TIER_COLORS[m.tier] || colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                        {(m.tier || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                {!m.is_available && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="moon" size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Offline</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{m.full_name || 'Unknown'}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{m.email || ''}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {m.jobs_completed || 0} job{(m.jobs_completed || 0) !== 1 ? 's' : ''} completed
                </Text>
                {m.rating_avg != null && m.rating_avg > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                      {Number(m.rating_avg).toFixed(1)} ({m.rating_count || 0})
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}