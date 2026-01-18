import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetDisputes, Dispute, formatSlaRemaining, isSlaSlaCritical } from '../../src/lib/disputes';
import {
  DISPUTE_STATUS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_PRIORITY,
  DISPUTE_PRIORITY_LABELS,
  DISPUTE_PRIORITY_COLORS,
  DisputeStatus,
  DisputePriority,
} from '../../src/constants/disputes';

const OPEN_STATUSES: string[] = [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.EVIDENCE_REQUESTED];

export default function AdminDisputesScreen() {
  const { colors, text } = useTheme();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    try {
      const data = await adminGetDisputes(statusFilter || undefined);
      setDisputes(data);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchDisputes();
    }, [fetchDisputes])
  );

  // Refetch when filters change
  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDisputes();
  };

  const openCount = disputes.filter(d => OPEN_STATUSES.includes(d.status)).length;
  const slaBreachedCount = disputes.filter(d => d.sla_breached).length;
  const highPriorityCount = disputes.filter(d => d.priority === DISPUTE_PRIORITY.HIGH && OPEN_STATUSES.includes(d.status)).length;

  const StatusFilterButton = ({ value, label }: { value: string | null; label: string }) => (
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
      <Text style={{ color: statusFilter === value ? '#fff' : colors.textSecondary, fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const DisputeCard = ({ dispute }: { dispute: Dispute }) => {
    const statusColor = DISPUTE_STATUS_COLORS[dispute.status as DisputeStatus] || colors.textSecondary;
    const priorityColor = DISPUTE_PRIORITY_COLORS[dispute.priority as DisputePriority] || colors.textSecondary;
    const isOpen = OPEN_STATUSES.includes(dispute.status);
    const slaCritical = isOpen && isSlaSlaCritical(dispute.response_deadline);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(admin)/disputes/${dispute.id}`)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: dispute.sla_breached ? '#EF4444' : slaCritical ? '#F59E0B' : colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ 
              paddingHorizontal: spacing.sm, 
              paddingVertical: 2, 
              borderRadius: 4, 
              backgroundColor: statusColor + '20' 
            }}>
              <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                {DISPUTE_STATUS_LABELS[dispute.status as DisputeStatus]}
              </Text>
            </View>
            <View style={{ 
              paddingHorizontal: spacing.sm, 
              paddingVertical: 2, 
              borderRadius: 4, 
              backgroundColor: priorityColor + '20' 
            }}>
              <Text style={{ color: priorityColor, fontSize: 11, fontWeight: '600' }}>
                {DISPUTE_PRIORITY_LABELS[dispute.priority as DisputePriority]}
              </Text>
            </View>
            {dispute.sla_breached && (
              <View style={{ 
                paddingHorizontal: spacing.sm, 
                paddingVertical: 2, 
                borderRadius: 4, 
                backgroundColor: '#EF444420' 
              }}>
                <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600' }}>SLA BREACHED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {new Date(dispute.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={{ ...text.body, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>
          {dispute.job_title || 'Job'}
        </Text>

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm }} numberOfLines={2}>
          {dispute.description}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {DISPUTE_CATEGORY_LABELS[dispute.category as keyof typeof DISPUTE_CATEGORY_LABELS] || dispute.category}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              By: {dispute.filed_by_name || 'Customer'}
            </Text>
          </View>
          
          {isOpen && dispute.response_deadline && !dispute.mechanic_response && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ 
                color: slaCritical ? '#F59E0B' : colors.textSecondary, 
                fontSize: 11,
                fontWeight: slaCritical ? '600' : '400'
              }}>
                {formatSlaRemaining(dispute.response_deadline)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Disputes</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={{
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.sm,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.accent }}>{openCount}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Open</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#EF4444' }}>{highPriorityCount}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>High Priority</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: slaBreachedCount > 0 ? '#EF4444' : colors.textSecondary }}>
            {slaBreachedCount}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>SLA Breached</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Filter by Status
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 50, paddingHorizontal: spacing.md }}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        <StatusFilterButton value={null} label="All" />
        <StatusFilterButton value="open" label="Open" />
        <StatusFilterButton value="under_review" label="Under Review" />
        <StatusFilterButton value="evidence_requested" label="Evidence Req." />
        <StatusFilterButton value="resolved_customer" label="Resolved" />
        <StatusFilterButton value="closed" label="Closed" />
      </ScrollView>

      {/* Disputes List */}
      <ScrollView
        style={{ flex: 1, padding: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {disputes.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...text.body, color: colors.textSecondary, marginTop: spacing.md }}>
              No disputes found
            </Text>
          </View>
        ) : (
          disputes.map(dispute => <DisputeCard key={dispute.id} dispute={dispute} />)
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}
