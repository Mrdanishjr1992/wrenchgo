import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { Invoice, InvoiceLineItem } from '../../src/types/job-lifecycle';
import { formatCents } from '../../src/types/job-lifecycle';
import { formatLineItemType, getLineItemIcon, approveLineItem, rejectLineItem } from '../../src/lib/invoice';

interface InvoiceViewProps {
  invoice: Invoice;
  role: 'customer' | 'mechanic';
  onRefresh?: () => void;
  showPendingActions?: boolean;
}

export function InvoiceView({ invoice, role, onRefresh, showPendingActions = true }: InvoiceViewProps) {
  const { colors, text, spacing } = useTheme();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (item: InvoiceLineItem) => {
    Alert.alert(
      'Approve Addition?',
      `Approve "${item.description}" for ${formatCents(item.total_cents)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(item.id);
            const result = await approveLineItem(item.id);
            setProcessingId(null);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to approve');
            } else {
              onRefresh?.();
            }
          },
        },
      ]
    );
  };

  const handleReject = async (item: InvoiceLineItem) => {
    Alert.alert(
      'Reject Addition?',
      `Are you sure you want to reject "${item.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            const result = await rejectLineItem(item.id);
            setProcessingId(null);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to reject');
            } else {
              onRefresh?.();
            }
          },
        },
      ]
    );
  };

  const renderLineItem = (item: InvoiceLineItem, showActions: boolean) => {
    const isPending = item.approval_status === 'pending';
    const isRejected = item.approval_status === 'rejected' || item.approval_status === 'auto_rejected';
    const isProcessing = processingId === item.id;

    return (
      <View
        key={item.id}
        style={[
          styles.lineItem,
          {
            backgroundColor: isPending ? `${colors.accent}10` : colors.surface,
            borderColor: isPending ? colors.accent : colors.border,
            opacity: isRejected ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.lineItemHeader}>
          <View style={styles.lineItemIcon}>
            <Ionicons
              name={getLineItemIcon(item.item_type) as any}
              size={18}
              color={isPending ? colors.accent : colors.textMuted}
            />
          </View>
          <View style={styles.lineItemDetails}>
            <Text style={[styles.lineItemDescription, { color: colors.textPrimary }]}>
              {item.description}
            </Text>
            <Text style={[styles.lineItemType, { color: colors.textMuted }]}>
              {formatLineItemType(item.item_type)}
              {item.quantity > 1 && ` × ${item.quantity}`}
            </Text>
          </View>
          <View style={styles.lineItemAmount}>
            <Text
              style={[
                styles.lineItemPrice,
                {
                  color: isRejected ? colors.textMuted : colors.textPrimary,
                  textDecorationLine: isRejected ? 'line-through' : 'none',
                },
              ]}
            >
              {formatCents(item.total_cents)}
            </Text>
            {isPending && (
              <View style={[styles.pendingBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.pendingBadgeText}>PENDING</Text>
              </View>
            )}
            {isRejected && (
              <Text style={[styles.rejectedText, { color: '#EF4444' }]}>Rejected</Text>
            )}
          </View>
        </View>

        {item.notes && (
          <Text style={[styles.lineItemNotes, { color: colors.textMuted }]}>
            {item.notes}
          </Text>
        )}

        {isPending && showActions && role === 'customer' && (
          <View style={styles.actionButtons}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Pressable
                  style={[styles.rejectButton, { borderColor: colors.border }]}
                  onPress={() => handleReject(item)}
                >
                  <Ionicons name="close" size={16} color="#EF4444" />
                  <Text style={[styles.rejectButtonText, { color: '#EF4444' }]}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.approveButton, { backgroundColor: colors.accent }]}
                  onPress={() => handleApprove(item)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.approveButtonText}>Approve</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {isPending && role === 'mechanic' && (
          <Text style={[styles.awaitingText, { color: colors.textMuted }]}>
            Awaiting customer approval
          </Text>
        )}
      </View>
    );
  };

  const { contract, approved_items, pending_items, rejected_items } = invoice;

  // Filter out platform_fee items - shown separately in summary
  const filteredApprovedItems = approved_items.filter(item => item.item_type !== 'platform_fee');

  return (
    <View style={styles.container}>
      {/* Pending Items Alert */}
      {pending_items.length > 0 && role === 'customer' && showPendingActions && (
        <View style={[styles.pendingAlert, { backgroundColor: `${colors.accent}15`, borderColor: colors.accent }]}>
          <Ionicons name="alert-circle" size={20} color={colors.accent} />
          <Text style={[styles.pendingAlertText, { color: colors.accent }]}>
            {pending_items.length} item{pending_items.length > 1 ? 's' : ''} awaiting your approval
          </Text>
        </View>
      )}

      {/* Pending Items */}
      {pending_items.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Pending Approval
          </Text>
          {pending_items.map(item => renderLineItem(item, showPendingActions))}
        </View>
      )}

      {/* Approved Items */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Invoice Items
        </Text>
        {filteredApprovedItems.map(item => renderLineItem(item, false))}
      </View>

      {/* Rejected Items (collapsed) */}
      {rejected_items.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            Rejected Items ({rejected_items.length})
          </Text>
          {rejected_items.map(item => renderLineItem(item, false))}
        </View>
      )}

      {/* Totals */}
      <View style={[styles.totalsSection, { borderTopColor: colors.border }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
            {role === 'mechanic' ? 'Quoted Amount' : 'Labor & Parts'}
          </Text>
          <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
            {formatCents(contract.subtotal_cents)}
          </Text>
        </View>

        {pending_items.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.accent }]}>
              + Pending Approval
            </Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>
              {formatCents(invoice.pending_subtotal_cents)}
            </Text>
          </View>
        )}

        {/* Platform fee - only show to customer */}
        {role === 'customer' && (
          <>
            <View style={styles.totalRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Platform Fee</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Booking, support & payment processing
                </Text>
              </View>
              <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
                {formatCents(contract.platform_fee_cents)}
              </Text>
            </View>

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={[styles.grandTotalLabel, { color: colors.textPrimary }]}>
                Total Due
              </Text>
              <Text style={[styles.grandTotalValue, { color: colors.accent }]}>
                {formatCents(contract.total_customer_cents)}
              </Text>
            </View>
          </>
        )}

        {/* Mechanic earnings breakdown */}
        {role === 'mechanic' && (
          <>
            <View style={[styles.totalRow, { marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
                  Service Fee (12%, max $50)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  On labor only, parts excluded
                </Text>
              </View>
              <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                -{formatCents(contract.mechanic_commission_cents)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={[styles.grandTotalLabel, { color: colors.textPrimary }]}>
                Your Earnings
              </Text>
              <Text style={[styles.grandTotalValue, { color: '#10B981' }]}>
                {formatCents(contract.mechanic_payout_cents)}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  pendingAlertText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  lineItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lineItemDetails: {
    flex: 1,
  },
  lineItemDescription: {
    fontSize: 15,
    fontWeight: '600',
  },
  lineItemType: {
    fontSize: 12,
    marginTop: 2,
  },
  lineItemAmount: {
    alignItems: 'flex-end',
  },
  lineItemPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  pendingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  rejectedText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  lineItemNotes: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  awaitingText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  totalsSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
});

export default InvoiceView;
