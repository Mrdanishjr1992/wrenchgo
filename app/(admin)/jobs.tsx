import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetJobs, AdminJob, formatDateTime } from '../../src/lib/admin';

const JOB_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  quoted: '#3B82F6',
  accepted: '#8B5CF6',
  in_progress: '#6366F1',
  completed: '#10B981',
  cancelled: '#6B7280',
};

export default function AdminJobsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await adminGetJobs(statusFilter || undefined);
      setJobs(data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { fetchJobs(); }, [fetchJobs]));

  const onRefresh = () => { setRefreshing(true); fetchJobs(); };

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Jobs</Text>
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
        <FilterButton value="pending" label="Pending" />
        <FilterButton value="quoted" label="Quoted" />
        <FilterButton value="in_progress" label="In Progress" />
        <FilterButton value="completed" label="Completed" />
      </ScrollView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {jobs.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No jobs found</Text>
        ) : (
          jobs.map(job => (
            <TouchableOpacity
              key={job.id}
              onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
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
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: (JOB_STATUS_COLORS[job.status] || colors.textSecondary) + '20',
                }}>
                  <Text style={{ color: JOB_STATUS_COLORS[job.status] || colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {job.status.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {job.has_dispute && (
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  )}
                  {job.has_support_ticket && (
                    <Ionicons name="chatbubble-ellipses" size={16} color="#8B5CF6" />
                  )}
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>{job.title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                Customer: {job.customer_name}
              </Text>
              {job.mechanic_name && (
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Mechanic: {job.mechanic_name}
                </Text>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {job.quote_count} quote{job.quote_count !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {formatDateTime(job.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
