import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/ui/theme-context';
import { supabase } from '@/src/lib/supabase';
import { getDocumentUrl } from '@/src/lib/verification';
import {
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_DOC_LABELS,
  DOC_STATUS,
} from '@/src/constants/verification';

interface PendingMechanic {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  verification_status: string;
  docs_count: number;
  docs_complete: boolean;
  vetting_count: number;
  created_at: string;
}

interface MechanicDetails {
  profile: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  mechanic_profile: {
    verification_status: string;
    verification_updated_at: string;
    verification_reason: string | null;
    business_name: string | null;
    bio: string | null;
    years_experience: number | null;
  } | null;
  documents: {
    id: string;
    doc_type: string;
    bucket: string;
    path: string;
    status: string;
    uploaded_at: string;
    reviewed_at: string | null;
    review_notes: string | null;
  }[];
  vetting_responses: {
    id: string;
    prompt_key: string;
    prompt_text: string;
    response_text: string;
    created_at: string;
  }[];
  vetting_review: {
    id: string;
    status: string;
    notes: string | null;
    reviewed_at: string | null;
  } | null;
}

export default function AdminVerificationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [mechanics, setMechanics] = useState<PendingMechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState<MechanicDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<'approve' | 'reject' | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const fetchMechanics = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_pending_verifications', {
        p_status_filter: statusFilter === 'all' ? null : statusFilter,
      });
      if (error) throw error;
      setMechanics(data || []);
    } catch (err: any) {
      console.error('Error fetching mechanics:', err);
      Alert.alert('Error', 'Failed to fetch mechanics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchMechanics();
  }, [fetchMechanics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMechanics();
  };

  const fetchMechanicDetails = async (mechanicId: string) => {
    setDetailsLoading(true);
    setDetailsModalVisible(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_mechanic_verification_details', {
        p_mechanic_id: mechanicId,
      });
      if (error) throw error;
      setSelectedMechanic(data);
    } catch (err: any) {
      console.error('Error fetching details:', err);
      Alert.alert('Error', 'Failed to fetch mechanic details');
      setDetailsModalVisible(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleReviewDocument = async (docId: string, action: 'approve' | 'reject') => {
    setCurrentDocId(docId);
    setCurrentAction(action);
    setReviewNotes('');
    setReviewModalVisible(true);
  };

  const submitDocumentReview = async () => {
    if (!currentDocId || !currentAction) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_review_document', {
        p_doc_id: currentDocId,
        p_status: currentAction === 'approve' ? DOC_STATUS.APPROVED : DOC_STATUS.REJECTED,
        p_notes: reviewNotes || null,
      });
      if (error) throw error;
      setReviewModalVisible(false);
      if (selectedMechanic) {
        fetchMechanicDetails(selectedMechanic.profile.id);
      }
      Alert.alert('Success', `Document ${currentAction}d`);
    } catch (err: any) {
      console.error('Error reviewing document:', err);
      Alert.alert('Error', 'Failed to review document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetVerificationStatus = async (mechanicId: string, status: string, reason: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('admin_set_verification_status', {
        p_mechanic_id: mechanicId,
        p_status: status,
        p_reason: reason || null,
      });
      if (error) throw error;
      setDetailsModalVisible(false);
      fetchMechanics();
      Alert.alert('Success', 'Verification status updated');
    } catch (err: any) {
      console.error('Error setting status:', err);
      Alert.alert('Error', 'Failed to update verification status');
    } finally {
      setActionLoading(false);
    }
  };

  const openDocument = async (bucket: string, path: string) => {
    const url = await getDocumentUrl(bucket, path);
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Failed to get document URL');
    }
  };

  const renderMechanicCard = (mechanic: PendingMechanic) => (
    <TouchableOpacity
      key={mechanic.id}
      onPress={() => fetchMechanicDetails(mechanic.id)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {mechanic.avatar_url ? (
          <Image
            source={{ uri: mechanic.avatar_url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.accent + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="person" size={24} color={colors.accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
            {mechanic.full_name || 'Unknown'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{mechanic.email}</Text>
        </View>
        <View style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: getStatusColor(mechanic.verification_status) + '20',
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: getStatusColor(mechanic.verification_status),
          }}>
            {VERIFICATION_STATUS_LABELS[mechanic.verification_status as keyof typeof VERIFICATION_STATUS_LABELS] || mechanic.verification_status}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons
            name={mechanic.docs_complete ? 'checkmark-circle' : 'document-outline'}
            size={14}
            color={mechanic.docs_complete ? '#10b981' : colors.textMuted}
          />
          <Text style={{ fontSize: 12, color: mechanic.docs_complete ? '#10b981' : colors.textMuted }}>
            {mechanic.docs_count}/4 docs
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chatbox-outline" size={14} color={colors.textMuted} />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{mechanic.vetting_count} responses</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case VERIFICATION_STATUS.ACTIVE: return '#10b981';
      case VERIFICATION_STATUS.PENDING_VERIFICATION: return '#f59e0b';
      case VERIFICATION_STATUS.PAUSED: return '#6366f1';
      case VERIFICATION_STATUS.REMOVED: return '#ef4444';
      default: return colors.textMuted;
    }
  };

  const renderDetailsModal = () => (
    <Modal
      visible={detailsModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setDetailsModalVisible(false)}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          paddingTop: insets.top + 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
            Mechanic Details
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {detailsLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : selectedMechanic ? (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {selectedMechanic.profile.avatar_url ? (
                  <Image
                    source={{ uri: selectedMechanic.profile.avatar_url }}
                    style={{ width: 64, height: 64, borderRadius: 32 }}
                  />
                ) : (
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.accent + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="person" size={32} color={colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
                    {selectedMechanic.profile.full_name || 'Unknown'}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{selectedMechanic.profile.email}</Text>
                  {selectedMechanic.profile.phone && (
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>{selectedMechanic.profile.phone}</Text>
                  )}
                </View>
              </View>

              {selectedMechanic.mechanic_profile && (
                <View style={{ marginTop: 16, gap: 8 }}>
                  {selectedMechanic.mechanic_profile.business_name && (
                    <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                      <Text style={{ fontWeight: '600' }}>Business: </Text>
                      {selectedMechanic.mechanic_profile.business_name}
                    </Text>
                  )}
                  {selectedMechanic.mechanic_profile.years_experience && (
                    <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                      <Text style={{ fontWeight: '600' }}>Experience: </Text>
                      {selectedMechanic.mechanic_profile.years_experience} years
                    </Text>
                  )}
                  {selectedMechanic.mechanic_profile.bio && (
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>
                      {selectedMechanic.mechanic_profile.bio}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
              Documents ({selectedMechanic.documents.length})
            </Text>
            {selectedMechanic.documents.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>
                No documents uploaded yet
              </Text>
            ) : (
              selectedMechanic.documents.map((doc) => (
                <View key={doc.id} style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                      {VERIFICATION_DOC_LABELS[doc.doc_type as keyof typeof VERIFICATION_DOC_LABELS] || doc.doc_type}
                    </Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      backgroundColor: doc.status === DOC_STATUS.APPROVED ? '#10b98120' :
                        doc.status === DOC_STATUS.REJECTED ? '#ef444420' : '#f59e0b20',
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: doc.status === DOC_STATUS.APPROVED ? '#10b981' :
                          doc.status === DOC_STATUS.REJECTED ? '#ef4444' : '#f59e0b',
                      }}>
                        {doc.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {doc.doc_type === 'selfie_with_id' && (
                    <Text style={{ fontSize: 12, color: colors.info || '#3b82f6', marginTop: 4, fontStyle: 'italic' }}>
                      Compare selfie to ID front.
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => openDocument(doc.bucket, doc.path)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.accent} />
                    <Text style={{ fontSize: 13, color: colors.accent }}>View Document</Text>
                  </TouchableOpacity>
                  {doc.review_notes && (
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
                      Notes: {doc.review_notes}
                    </Text>
                  )}
                  {doc.status === DOC_STATUS.PENDING && (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => handleReviewDocument(doc.id, 'approve')}
                        style={{
                          flex: 1,
                          backgroundColor: '#10b98120',
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#10b981' }}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleReviewDocument(doc.id, 'reject')}
                        style={{
                          flex: 1,
                          backgroundColor: '#ef444420',
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#ef4444' }}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}

            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 12 }}>
              Vetting Responses ({selectedMechanic.vetting_responses.length})
            </Text>
            {selectedMechanic.vetting_responses.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>
                No vetting responses yet
              </Text>
            ) : (
              selectedMechanic.vetting_responses.map((response) => (
                <View key={response.id} style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                    {response.prompt_text}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
                    {response.response_text}
                  </Text>
                </View>
              ))
            )}

            {selectedMechanic.vetting_review && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Vetting Review Status: {selectedMechanic.vetting_review.status}
                </Text>
                {selectedMechanic.vetting_review.notes && (
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                    Notes: {selectedMechanic.vetting_review.notes}
                  </Text>
                )}
              </View>
            )}

            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 12 }}>
              Set Verification Status
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Object.values(VERIFICATION_STATUS).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setSelectedStatus(value);
                    setStatusReason('');
                    setStatusModalVisible(true);
                  }}
                  disabled={actionLoading}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: getStatusColor(value) + '20',
                    borderWidth: 1,
                    borderColor: getStatusColor(value) + '40',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: getStatusColor(value) }}>
                    {VERIFICATION_STATUS_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );

  const renderStatusModal = () => (
    <Modal
      visible={statusModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 400,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
            Set Status to {selectedStatus ? VERIFICATION_STATUS_LABELS[selectedStatus as keyof typeof VERIFICATION_STATUS_LABELS] : ''}
          </Text>
          <TextInput
            value={statusReason}
            onChangeText={setStatusReason}
            placeholder="Add reason (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              backgroundColor: colors.bg,
              borderRadius: 8,
              padding: 12,
              minHeight: 80,
              color: colors.textPrimary,
              marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setStatusModalVisible(false)}
              style={{
                flex: 1,
                backgroundColor: colors.bg,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (selectedMechanic && selectedStatus) {
                  handleSetVerificationStatus(selectedMechanic.profile.id, selectedStatus, statusReason);
                  setStatusModalVisible(false);
                }
              }}
              disabled={actionLoading}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderReviewModal = () => (
    <Modal
      visible={reviewModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setReviewModalVisible(false)}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 400,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
            {currentAction === 'approve' ? 'Approve Document' : 'Reject Document'}
          </Text>
          <TextInput
            value={reviewNotes}
            onChangeText={setReviewNotes}
            placeholder="Add notes (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              backgroundColor: colors.bg,
              borderRadius: 8,
              padding: 12,
              minHeight: 80,
              color: colors.textPrimary,
              marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setReviewModalVisible(false)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitDocumentReview}
              disabled={actionLoading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: currentAction === 'approve' ? '#10b981' : '#ef4444',
                alignItems: 'center',
              }}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                  {currentAction === 'approve' ? 'Approve' : 'Reject'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.primary, colors.primary + '28']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top, paddingBottom: 16, paddingHorizontal: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
            Mechanic Verification
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        {['all', VERIFICATION_STATUS.PENDING_VERIFICATION, VERIFICATION_STATUS.ACTIVE, VERIFICATION_STATUS.PAUSED].map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setStatusFilter(status)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: statusFilter === status ? colors.accent : colors.surface,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              color: statusFilter === status ? colors.black : colors.textMuted,
            }}>
              {status === 'all' ? 'All' : VERIFICATION_STATUS_LABELS[status as keyof typeof VERIFICATION_STATUS_LABELS]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {mechanics.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 12 }}>
                No mechanics to review
              </Text>
            </View>
          ) : (
            mechanics.map(renderMechanicCard)
          )}
        </ScrollView>
      )}

      {renderDetailsModal()}
      {renderReviewModal()}
      {renderStatusModal()}
    </View>
  );
}
