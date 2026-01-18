import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import {
  adminGetDisputeDetail,
  adminResolveDispute,
  DisputeDetail,
  formatSlaRemaining,
} from '../../../src/lib/disputes';
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_RESOLUTION_TYPE,
  DISPUTE_RESOLUTION_LABELS,
  DISPUTE_PRIORITY_LABELS,
  DISPUTE_PRIORITY_COLORS,
  DisputeStatus,
  DisputePriority,
  DisputeResolutionType,
} from '../../../src/constants/disputes';
import { AdminEvidenceGallery } from '../../../components/media/AdminEvidenceGallery';

export default function AdminDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text } = useTheme();
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionType, setResolutionType] = useState<DisputeResolutionType>(DISPUTE_RESOLUTION_TYPE.NO_ACTION);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('0');

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const data = await adminGetDisputeDetail(id);
      setDetail(data);
    } catch (error) {
      console.error('Error fetching dispute detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      Alert.alert('Error', 'Please provide resolution notes');
      return;
    }

    setResolving(true);
    try {
      const refundCents = Math.round(parseFloat(refundAmount || '0') * 100);
      const result = await adminResolveDispute(
        id!,
        resolutionType,
        resolutionNotes,
        refundCents,
        0
      );

      if (result.success) {
        Alert.alert('Success', 'Dispute resolved successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to resolve dispute');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setResolving(false);
      setShowResolveModal(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Dispute not found</Text>
      </View>
    );
  }

  const dispute = detail.dispute;
  const statusColor = DISPUTE_STATUS_COLORS[dispute.status as DisputeStatus] || colors.textSecondary;
  const priorityColor = DISPUTE_PRIORITY_COLORS[dispute.priority as DisputePriority] || colors.textSecondary;
  const isResolved = ['resolved_customer', 'resolved_mechanic', 'resolved_split', 'closed'].includes(dispute.status);

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
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>Dispute Detail</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Status Banner */}
        <View style={{
          backgroundColor: statusColor + '20',
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ backgroundColor: statusColor, width: 8, height: 8, borderRadius: 4 }} />
            <Text style={{ color: statusColor, fontWeight: '600' }}>
              {DISPUTE_STATUS_LABELS[dispute.status as DisputeStatus]}
            </Text>
          </View>
          <View style={{
            backgroundColor: priorityColor + '30',
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: 4,
          }}>
            <Text style={{ color: priorityColor, fontSize: 12, fontWeight: '600' }}>
              {DISPUTE_PRIORITY_LABELS[dispute.priority as DisputePriority]}
            </Text>
          </View>
        </View>

        {/* SLA Warning */}
        {!isResolved && dispute.sla_breached && (
          <View style={{ backgroundColor: '#EF444420', padding: spacing.md }}>
            <Text style={{ color: '#EF4444', fontWeight: '600' }}>
              SLA BREACHED - Mechanic did not respond in time
            </Text>
          </View>
        )}

        {/* Main Info */}
        <View style={{ padding: spacing.md }}>
          {/* Job Info */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Job</Text>
            <Text style={{ ...text.body, fontWeight: '600' }}>{detail.job?.title || 'Unknown Job'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              Status: {detail.job?.status} | Created: {new Date(detail.job?.created_at).toLocaleDateString()}
            </Text>
          </View>

          {/* Parties */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Filed By</Text>
                <Text style={{ ...text.body, fontWeight: '600' }}>{detail.customer?.full_name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Customer</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Filed Against</Text>
                <Text style={{ ...text.body, fontWeight: '600' }}>{detail.mechanic?.full_name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Mechanic</Text>
              </View>
            </View>
          </View>

          {/* Dispute Details */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Category</Text>
            <Text style={{ ...text.body, marginBottom: spacing.md }}>
              {DISPUTE_CATEGORY_LABELS[dispute.category as keyof typeof DISPUTE_CATEGORY_LABELS] || dispute.category}
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Description</Text>
            <Text style={{ ...text.body, marginBottom: spacing.md }}>{dispute.description}</Text>

            {dispute.desired_resolution && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Desired Resolution</Text>
                <Text style={{ ...text.body, marginBottom: spacing.md }}>{dispute.desired_resolution}</Text>
              </>
            )}

            {!isResolved && dispute.response_deadline && !dispute.mechanic_response && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Response Deadline</Text>
                <Text style={{ ...text.body, color: dispute.sla_breached ? '#EF4444' : colors.textPrimary }}>
                  {formatSlaRemaining(dispute.response_deadline)}
                </Text>
              </>
            )}
          </View>

          {/* Mechanic Response */}
          {dispute.mechanic_response && (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.md,
              borderLeftWidth: 3,
              borderLeftColor: '#10B981',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Mechanic Response</Text>
              <Text style={{ ...text.body }}>{dispute.mechanic_response}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: spacing.sm }}>
                Responded: {new Date(dispute.mechanic_responded_at!).toLocaleString()}
                {dispute.sla_breached && ' (After deadline)'}
              </Text>
            </View>
          )}

          {/* Resolution (if resolved) */}
          {isResolved && dispute.resolution_type && (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.md,
              borderLeftWidth: 3,
              borderLeftColor: '#10B981',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Resolution</Text>
              <Text style={{ ...text.body, fontWeight: '600', marginBottom: 4 }}>
                {DISPUTE_RESOLUTION_LABELS[dispute.resolution_type as DisputeResolutionType]}
              </Text>
              {dispute.resolution_notes && (
                <Text style={{ ...text.body }}>{dispute.resolution_notes}</Text>
              )}
              {(dispute.customer_refund_cents ?? 0) > 0 && (
                <Text style={{ color: '#10B981', marginTop: spacing.sm }}>
                  Customer Refund: ${(dispute.customer_refund_cents! / 100).toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Evidence */}
          {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                Evidence ({dispute.evidence_urls.length} files)
              </Text>
              {dispute.evidence_urls.map((url, i) => (
                <TouchableOpacity key={i} style={{ marginBottom: spacing.xs }}>
                  <Text style={{ color: colors.accent }}>{url}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Timeline */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}>
            <Text style={{ ...text.body, fontWeight: '600', marginBottom: spacing.md }}>Timeline</Text>
            {(detail.events || []).slice(0, 10).map((event: any, i: number) => (
              <View key={i} style={{
                flexDirection: 'row',
                marginBottom: spacing.sm,
                paddingLeft: spacing.md,
                borderLeftWidth: 2,
                borderLeftColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontSize: 13 }}>{event.event_type || event.title || 'Event'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {new Date(event.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recent Messages */}
          {detail.messages && detail.messages.length > 0 && (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}>
              <Text style={{ ...text.body, fontWeight: '600', marginBottom: spacing.md }}>
                Recent Messages ({detail.messages.length})
              </Text>
              {detail.messages.slice(0, 5).map((msg: any, i: number) => (
                <View key={i} style={{
                  padding: spacing.sm,
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  marginBottom: spacing.sm,
                }}>
                  <Text style={{ ...text.body, fontSize: 13 }}>{msg.body}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Button */}
      {!isResolved && (
        <View style={{
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <TouchableOpacity
            onPress={() => setShowResolveModal(true)}
            style={{
              backgroundColor: colors.accent,
              padding: spacing.md,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Resolve Dispute</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resolve Modal */}
      <Modal visible={showResolveModal} animationType="slide" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.lg,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Resolve Dispute</Text>
              <TouchableOpacity onPress={() => setShowResolveModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                Resolution Type
              </Text>
              {Object.entries(DISPUTE_RESOLUTION_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setResolutionType(key as DisputeResolutionType)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    backgroundColor: resolutionType === key ? colors.accent + '20' : colors.background,
                    borderRadius: 8,
                    marginBottom: spacing.sm,
                  }}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: resolutionType === key ? colors.accent : colors.border,
                    marginRight: spacing.md,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    {resolutionType === key && (
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.accent,
                      }} />
                    )}
                  </View>
                  <Text style={{ ...text.body }}>{label}</Text>
                </TouchableOpacity>
              ))}

              {(resolutionType === DISPUTE_RESOLUTION_TYPE.PARTIAL_REFUND ||
                resolutionType === DISPUTE_RESOLUTION_TYPE.FULL_REFUND) && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>
                    Refund Amount ($)
                  </Text>
                  <TextInput
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 8,
                      padding: spacing.md,
                      color: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </>
              )}

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>
                Resolution Notes (Required)
              </Text>
              <TextInput
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                placeholder="Explain the resolution decision..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />

              <TouchableOpacity
                onPress={handleResolve}
                disabled={resolving || !resolutionNotes.trim()}
                style={{
                  backgroundColor: resolving || !resolutionNotes.trim() ? colors.border : colors.accent,
                  padding: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: spacing.lg,
                }}
              >
                {resolving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm Resolution</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
