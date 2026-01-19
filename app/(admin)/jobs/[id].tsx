import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetJobDetail, AdminJobDetail, formatCents, formatDateTime } from '../../../src/lib/admin';
import { AdminMessageModal } from '../../../components/admin/AdminMessageModal';

export default function AdminJobDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<AdminJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageRecipient, setMessageRecipient] = useState<{ id: string; name: string; role: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        adminGetJobDetail(id)
          .then(setDetail)
          .catch(console.error)
          .finally(() => setLoading(false));
      }
    }, [id])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Job not found</Text>
      </View>
    );
  }

  const { job, quotes, contract, events, disputes, support_requests, payments } = detail;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{value || '-'}</Text>
    </View>
  );

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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{job.title}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{job.status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Job Details">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            {job.vehicle_year && job.vehicle_make && job.vehicle_model && (
              <InfoRow label="Vehicle" value={`${job.vehicle_year} ${job.vehicle_make} ${job.vehicle_model}`} />
            )}
            <InfoRow label="Location" value={job.location_address} />
            <InfoRow label="Created" value={formatDateTime(job.created_at)} />
            {job.scheduled_at && <InfoRow label="Scheduled" value={formatDateTime(job.scheduled_at)} />}
            {job.completed_at && <InfoRow label="Completed" value={formatDateTime(job.completed_at)} />}
          </View>
        </Section>

        <Section title="Customer">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Name" value={job.customer_name} />
            <InfoRow label="Email" value={job.customer_email} />
            {job.customer_id && (
              <TouchableOpacity
                onPress={() => setMessageRecipient({ id: job.customer_id!, name: job.customer_name || 'Customer', role: 'Customer' })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.sm,
                  backgroundColor: '#8B5CF6',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Message Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>

        {contract && (
          <Section title="Contract">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <InfoRow label="Mechanic" value={contract.mechanic_name} />
              <InfoRow label="Status" value={contract.status} />
              <InfoRow label="Quoted" value={formatCents(contract.quoted_price_cents || 0)} />
              <InfoRow label="Subtotal" value={formatCents(contract.subtotal_cents || 0)} />
              <InfoRow label="Customer Total" value={formatCents(contract.total_customer_cents || 0)} />
              <InfoRow label="Mechanic Payout" value={formatCents(contract.mechanic_payout_cents || 0)} />
              {contract.accepted_at && <InfoRow label="Accepted" value={formatDateTime(contract.accepted_at)} />}
              {contract.completed_at && <InfoRow label="Completed" value={formatDateTime(contract.completed_at)} />}
              {contract.mechanic_id && (
                <TouchableOpacity
                  onPress={() => setMessageRecipient({ id: contract.mechanic_id, name: contract.mechanic_name || 'Mechanic', role: 'Mechanic' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: spacing.sm,
                    backgroundColor: '#8B5CF6',
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Message Mechanic</Text>
                </TouchableOpacity>
              )}
            </View>
          </Section>
        )}

        <Section title={`Quotes (${quotes.length})`}>
          {quotes.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No quotes</Text>
          ) : (
            quotes.map(q => (
              <View key={q.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{q.mechanic_name}</Text>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{formatCents(q.price_cents)}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{q.status}</Text>
                {q.notes && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{q.notes}</Text>
                )}
              </View>
            ))
          )}
        </Section>

        {disputes.length > 0 && (
          <Section title={`Disputes (${disputes.length})`}>
            {disputes.map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push(`/(admin)/disputes/${d.id}`)}
                style={{ backgroundColor: '#EF444410', borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: '#EF4444' }}>{d.category}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{d.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {support_requests.length > 0 && (
          <Section title={`Support Tickets (${support_requests.length})`}>
            {support_requests.map(sr => (
              <View key={sr.id} style={{ backgroundColor: '#8B5CF610', borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>{sr.message}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{sr.category} - {sr.status}</Text>
              </View>
            ))}
          </Section>
        )}

        {payments.length > 0 && (
          <Section title={`Payments (${payments.length})`}>
            {payments.map(p => (
              <View key={p.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{formatCents(p.amount_cents)}</Text>
                  <Text style={{ color: p.status === 'completed' ? '#10B981' : colors.textSecondary, fontSize: 12 }}>{p.status}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section title={`Timeline (${events.length})`}>
          {events.slice(0, 20).map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6, marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: colors.textPrimary }}>{e.event_type.replace(/_/g, ' ')}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatDateTime(e.created_at)}</Text>
              </View>
            </View>
          ))}
        </Section>
      </ScrollView>

      {messageRecipient && (
        <AdminMessageModal
          visible={!!messageRecipient}
          onClose={() => setMessageRecipient(null)}
          recipient={messageRecipient}
          relatedJobId={id}
          relatedJobTitle={job.title}
        />
      )}
    </View>
  );
}
