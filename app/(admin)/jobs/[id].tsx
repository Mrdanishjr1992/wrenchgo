import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Pressable, Dimensions } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetJobDetail, formatCents, formatDateTime } from '../../../src/lib/admin';
import { parseJobDescription, formatVehicle, formatAnswers, formatContext } from '../../../src/lib/parse-job-description';

interface MediaItem {
  id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  media_category: string;
  created_at: string;
}

interface JobEvidence {
  customer_request?: MediaItem[];
  mechanic_before?: MediaItem[];
  mechanic_after?: MediaItem[];
  dispute_evidence?: MediaItem[];
  support_evidence?: MediaItem[];
  parts_receipt?: MediaItem[];
  other?: MediaItem[];
}

interface UserInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ContractInfo {
  id: string;
  status: string;
  quoted_price_cents: number;
  platform_fee_cents: number;
  estimated_hours: number | null;
  subtotal_cents: number;
  total_customer_cents: number;
  mechanic_commission_cents: number;
  mechanic_payout_cents: number;
  payment_authorized_at: string | null;
  payment_captured_at: string | null;
  created_at: string;
}

interface PayoutInfo {
  id: string;
  status: string;
  gross_amount_cents: number;
  commission_cents: number;
  net_amount_cents: number;
  created_at: string;
  processed_at: string | null;
}

interface FinancialsInfo {
  laborCents: number;
  partsCents: number;
  subtotalCents: number;
  platformFeeCents: number;
  totalCustomerCents: number;
  commissionCents: number;
  mechanicPayoutCents: number;
}

interface JobDetail {
  job: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    symptom_key: string | null;
    customer_id: string;
    accepted_mechanic_id: string | null;
    hub_id: string | null;
    location_lat: number | null;
    location_lng: number | null;
    location_address: string | null;
    preferred_time: string | null;
    final_price_cents: number | null;
    created_at: string;
    scheduled_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
  };
  quotes: Array<{
    id: string;
    mechanic_id: string;
    price_cents: number | null;
    estimated_hours: number | null;
    notes: string | null;
    status: string;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    category: string;
    priority: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;
  supportRequests: Array<{
    id: string;
    status: string;
    category: string;
    message: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount_cents: number;
    platform_fee_cents: number;
    created_at: string;
    paid_at: string | null;
  }>;
  customer: UserInfo | null;
  mechanic: UserInfo | null;
  evidence: JobEvidence | null;
  acceptedQuote: {
    id: string;
    price_cents: number | null;
    estimated_hours: number | null;
  } | null;
  contract: ContractInfo | null;
  lineItems: Array<{
    id: string;
    item_type: string;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
    part_number: string | null;
    part_source: string | null;
    approval_status: string;
    notes: string | null;
    created_at: string;
  }>;
  messages: Array<{
    id: string;
    sender_id: string;
    sender_name: string;
    sender_role: string;
    recipient_id: string;
    recipient_name: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }>;
  payout: PayoutInfo | null;
  financials: FinancialsInfo;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#3B82F6',
  pending: '#F59E0B',
  cancelled: '#EF4444',
  open: '#F59E0B',
  resolved: '#10B981',
  succeeded: '#10B981',
  accepted: '#3B82F6',
};

export default function AdminJobDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setError(null);
        adminGetJobDetail(id)
          .then(setDetail)
          .catch((err) => {
            console.error('Error:', err);
            setError(err?.message || 'Failed to load job');
          })
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

  if (error || !detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>{error || 'Job not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { job, quotes, disputes, supportRequests, payments, customer, mechanic, evidence, acceptedQuote, contract, lineItems, messages, payout, financials } = detail;
  const parsedDesc = parseJobDescription(job.description);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value, accent, color }: { label: string; value: string | null | undefined; accent?: boolean; color?: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: color || (accent ? colors.accent : colors.textPrimary), fontSize: 14, fontWeight: '500' }}>{value || '-'}</Text>
    </View>
  );

  const PhotoGrid = ({ title, items, emptyText }: { title: string; items: MediaItem[]; emptyText?: string }) => {
    if (!items || items.length === 0) {
      if (!emptyText) return null;
      return (
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>{emptyText}</Text>
        </View>
      );
    }
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm }}>{title} ({items.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item, idx) => (
            <TouchableOpacity key={item.id || idx} onPress={() => setPreviewImage(item.public_url || item.storage_path)}>
              <Image
                source={{ uri: item.public_url || item.storage_path }}
                style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: colors.border }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const totalPaid = payments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + p.amount_cents, 0);
  const expectedCommission = Math.round(financials.laborCents * 0.12);
  const commissionMismatch = financials.commissionCents !== expectedCommission && financials.laborCents > 0;

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
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: (STATUS_COLORS[job.status] || colors.textSecondary) + '20',
            alignSelf: 'flex-start',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 11, color: STATUS_COLORS[job.status] || colors.textSecondary, fontWeight: '600' }}>
              {job.status.toUpperCase().replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {/* Job Summary Card */}
        <Section title="Job Summary">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Created" value={formatDateTime(job.created_at)} />
            {job.scheduled_at && <InfoRow label="Scheduled" value={formatDateTime(job.scheduled_at)} />}
            {job.completed_at && <InfoRow label="Completed" value={formatDateTime(job.completed_at)} />}
            {job.cancelled_at && <InfoRow label="Cancelled" value={formatDateTime(job.cancelled_at)} />}
            {job.final_price_cents && <InfoRow label="Final Price" value={formatCents(job.final_price_cents)} accent />}
          </View>
        </Section>

        {/* Issue / Symptom Section */}
        {parsedDesc && (
          <Section title="Issue Details">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              {parsedDesc.symptom?.label && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Symptom</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 }}>{parsedDesc.symptom.label}</Text>
                </View>
              )}
              {parsedDesc.vehicle && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Vehicle</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{formatVehicle(parsedDesc.vehicle) || '-'}</Text>
                </View>
              )}
              {formatAnswers(parsedDesc.answers).length > 0 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Additional Info</Text>
                  {formatAnswers(parsedDesc.answers).map((a, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{a.key}</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{a.value}</Text>
                    </View>
                  ))}
                </View>
              )}
              {formatContext(parsedDesc.context).length > 0 && (
                <View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Context</Text>
                  {formatContext(parsedDesc.context).map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.label}</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{c.value}</Text>
                    </View>
                  ))}
                </View>
              )}
              {parsedDesc.raw && !parsedDesc.symptom && !parsedDesc.vehicle && (
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{parsedDesc.raw}</Text>
              )}
            </View>
          </Section>
        )}

        {/* Location */}
        {job.location_address && (
          <Section title="Location">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{job.location_address}</Text>
              {job.preferred_time && (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Preferred: {job.preferred_time}</Text>
              )}
            </View>
          </Section>
        )}

        {/* Customer & Mechanic */}
        <Section title="Parties">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Customer</Text>
            {customer ? (
              <TouchableOpacity onPress={() => router.push(`/(admin)/customers/${customer.id}`)}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '500' }}>{customer.full_name || customer.email}</Text>
                {customer.phone && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{customer.phone}</Text>}
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>Unknown</Text>
            )}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Mechanic</Text>
            {mechanic ? (
              <TouchableOpacity onPress={() => router.push(`/(admin)/mechanics/${mechanic.id}`)}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '500' }}>{mechanic.full_name || mechanic.email}</Text>
                {mechanic.phone && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{mechanic.phone}</Text>}
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>Not assigned</Text>
            )}
          </View>
        </Section>

        {/* Financial Breakdown */}
        <Section title="Financial Breakdown">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            {contract ? (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: spacing.sm }}>CUSTOMER SIDE</Text>
                {financials.laborCents > 0 && (
                  <InfoRow label="Labor" value={formatCents(financials.laborCents)} />
                )}
                {financials.partsCents > 0 && (
                  <InfoRow label="Parts" value={formatCents(financials.partsCents)} />
                )}
                <InfoRow label="Subtotal" value={formatCents(financials.subtotalCents)} />
                <InfoRow label="Platform Fee" value={formatCents(financials.platformFeeCents)} color="#10B981" />
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
                <InfoRow label="Customer Total" value={formatCents(financials.totalCustomerCents)} accent />

                <View style={{ height: spacing.md }} />
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: spacing.sm }}>MECHANIC SIDE</Text>
                <InfoRow label="Gross Amount" value={formatCents(financials.subtotalCents)} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: '#F59E0B', fontSize: 14 }}>Commission (12% of labor)</Text>
                  <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: '500' }}>-{formatCents(financials.commissionCents)}</Text>
                </View>
                {commissionMismatch && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Ionicons name="warning" size={12} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 11 }}>
                      Expected: {formatCents(expectedCommission)} (12% of {formatCents(financials.laborCents)})
                    </Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
                <InfoRow label="Mechanic Payout" value={formatCents(financials.mechanicPayoutCents)} accent />

                {acceptedQuote?.estimated_hours && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.sm }}>
                    Estimated: {acceptedQuote.estimated_hours} hours
                  </Text>
                )}
              </>
            ) : job.final_price_cents ? (
              <InfoRow label="Final Price" value={formatCents(job.final_price_cents)} accent />
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No contract created yet</Text>
            )}
          </View>
        </Section>

        {/* Payout Status */}
        {payout && (
          <Section title="Payout Status">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{formatCents(payout.net_amount_cents)}</Text>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  backgroundColor: (STATUS_COLORS[payout.status] || colors.textSecondary) + '20',
                }}>
                  <Text style={{ fontSize: 11, color: STATUS_COLORS[payout.status] || colors.textSecondary, fontWeight: '600' }}>
                    {payout.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <InfoRow label="Gross" value={formatCents(payout.gross_amount_cents)} />
              <InfoRow label="Commission" value={`-${formatCents(payout.commission_cents)}`} color="#F59E0B" />
              <InfoRow label="Net" value={formatCents(payout.net_amount_cents)} accent />
              {payout.processed_at && (
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
                  Processed: {formatDateTime(payout.processed_at)}
                </Text>
              )}
            </View>
          </Section>
        )}

        {/* Line Items / Parts */}
        <Section title={`Invoice Items (${lineItems.length})`}>
          {lineItems.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No items on invoice</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              {lineItems.map((item, idx) => (
                <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: idx < lineItems.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{item.description}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {item.item_type.replace(/_/g, ' ')} • Qty: {item.quantity}
                        {item.part_number ? ` • #${item.part_number}` : ''}
                      </Text>
                      {item.part_source && (
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Source: {item.part_source}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{formatCents(item.total_cents)}</Text>
                      <View style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        marginTop: 4,
                        backgroundColor: item.approval_status === 'approved' ? '#10B98120' : item.approval_status === 'rejected' ? '#EF444420' : '#F59E0B20',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: item.approval_status === 'approved' ? '#10B981' : item.approval_status === 'rejected' ? '#EF4444' : '#F59E0B' }}>
                          {item.approval_status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
              <InfoRow label="Approved Total" value={formatCents(lineItems.filter(i => i.approval_status === 'approved').reduce((sum, i) => sum + i.total_cents, 0))} accent />
            </View>
          )}
        </Section>

        {/* Payment History */}
        {payments.length > 0 && (
          <Section title="Payment History">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <InfoRow label="Total Collected" value={formatCents(totalPaid)} accent />
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
              {payments.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{formatCents(p.amount_cents)}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.paid_at ? formatDateTime(p.paid_at) : formatDateTime(p.created_at)}</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: (STATUS_COLORS[p.status] || colors.textSecondary) + '20',
                  }}>
                    <Text style={{ fontSize: 10, color: STATUS_COLORS[p.status] || colors.textSecondary, fontWeight: '600' }}>
                      {p.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Chat History */}
        <Section title={`Chat History (${messages.length})`}>
          {messages.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No messages</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              {messages.map((msg, idx) => (
                <View key={msg.id} style={{ paddingVertical: 8, borderBottomWidth: idx < messages.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: msg.sender_role === 'mechanic' ? '#3B82F6' : '#10B981', fontSize: 13, fontWeight: '600' }}>
                      {msg.sender_name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {formatDateTime(msg.created_at)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{msg.body}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Evidence Photos */}
        {evidence && (
          <Section title="Evidence Photos">
            <PhotoGrid title="Customer Photos" items={evidence.customer_request || []} emptyText="No customer photos" />
            <PhotoGrid title="Mechanic Before" items={evidence.mechanic_before || []} />
            <PhotoGrid title="Mechanic After" items={evidence.mechanic_after || []} />
            <PhotoGrid title="Parts Receipts" items={evidence.parts_receipt || []} />
            <PhotoGrid title="Dispute Evidence" items={evidence.dispute_evidence || []} />
            <PhotoGrid title="Support Evidence" items={evidence.support_evidence || []} />
            <PhotoGrid title="Other" items={evidence.other || []} />
          </Section>
        )}

        {/* All Quotes */}
        <Section title={`All Quotes (${quotes.length})`}>
          {quotes.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>No quotes</Text>
          ) : (
            quotes.map(q => (
              <View key={q.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>
                    {formatCents(q.price_cents || 0)}
                  </Text>
                  <View style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: (STATUS_COLORS[q.status] || colors.textSecondary) + '20',
                  }}>
                    <Text style={{ fontSize: 11, color: STATUS_COLORS[q.status] || colors.textSecondary, fontWeight: '600' }}>
                      {q.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {q.estimated_hours && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                    Est. {q.estimated_hours} hours
                  </Text>
                )}
                {q.notes && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{q.notes}</Text>
                )}
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  {formatDateTime(q.created_at)}
                </Text>
              </View>
            ))
          )}
        </Section>

        {/* Disputes */}
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
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {formatDateTime(d.created_at)}
                </Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Support Requests */}
        {supportRequests.length > 0 && (
          <Section title={`Support Tickets (${supportRequests.length})`}>
            {supportRequests.map(sr => (
              <TouchableOpacity
                key={sr.id}
                onPress={() => router.push(`/(admin)/support/${sr.id}`)}
                style={{ backgroundColor: '#8B5CF610', borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <Text style={{ fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>{sr.message}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {sr.category.replace(/_/g, ' ')} - {sr.status}
                </Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setPreviewImage(null)}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 20, right: 20, zIndex: 10 }}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{ width: Dimensions.get('window').width - 40, height: Dimensions.get('window').height * 0.7 }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
