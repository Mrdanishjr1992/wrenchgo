import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { supabase } from '../../../src/lib/supabase';
import {
  getVerificationStatus,
  getVerificationDocuments,
  getVettingResponses,
  getDocumentUrl,
  adminSetMechanicTier,
  VerificationStatus,
  VerificationDocument,
  VettingResponse,
} from '../../../src/lib/verification';
import { MECHANIC_TIER, MECHANIC_TIER_LABELS, MECHANIC_TIER_COLORS, MechanicTier } from '../../../src/constants/verification';

const STATUS_COLORS: Record<string, string> = {
  pending_verification: '#F59E0B',
  active: '#10B981',
  paused: '#6B7280',
  removed: '#EF4444',
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
};

interface MechanicProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  mechanic_profiles: {
    bio: string | null;
    years_experience: number | null;
    verification_status: string | null;
    verification_reason: string | null;
  }[] | null;
}

export default function AdminVerificationDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [vettingResponses, setVettingResponses] = useState<VettingResponse[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, phone, city, state, created_at,
          mechanic_profiles(bio, years_experience, verification_status, verification_reason)
        `)
        .eq('id', id)
        .single();
      
      if (profileError) throw profileError;
      setProfile(profileData);
      
      // Fetch verification status
      const status = await getVerificationStatus(id);
      setVerificationStatus(status);
      
      // Fetch documents
      const docs = await getVerificationDocuments(id);
      setDocuments(docs);
      
      // Fetch document URLs
      const urls: Record<string, string> = {};
      for (const doc of docs) {
        const url = await getDocumentUrl(doc.bucket, doc.path);
        if (url) urls[doc.id] = url;
      }
      setDocumentUrls(urls);
      
      // Fetch vetting responses
      const responses = await getVettingResponses(id);
      setVettingResponses(responses);
      
    } catch (err: any) {
      console.error('Error fetching verification data:', err);
      setError(err?.message || 'Failed to load verification data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleSetStatus = async (newStatus: string, reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('mechanic_profiles')
        .update({
          verification_status: newStatus,
          verification_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
      Alert.alert('Success', `Mechanic status updated to ${newStatus}`);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDocument = async (docId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('mechanic_verification_documents')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', docId);
      
      if (error) throw error;
      Alert.alert('Success', 'Document approved');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async (docId: string) => {
    Alert.prompt('Rejection Reason', 'Enter reason for rejection:', async (reason) => {
      if (!reason) return;
      setActionLoading(true);
      try {
        const { error } = await supabase
          .from('mechanic_verification_documents')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            review_notes: reason,
          })
          .eq('id', docId);
        
        if (error) throw error;
        Alert.alert('Success', 'Document rejected');
        fetchData();
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to reject document');
      } finally {
        setActionLoading(false);
      }
    });
  };

  const confirmStatusChange = (newStatus: string, label: string) => {
    if (newStatus === 'removed') {
      Alert.prompt('Removal Reason', 'Enter reason for removal:', (reason) => {
        if (reason) handleSetStatus(newStatus, reason);
      });
    } else {
      Alert.alert(
        'Confirm Action',
        `Are you sure you want to ${label.toLowerCase()} this mechanic?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => handleSetStatus(newStatus) },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>{error || 'Mechanic not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mp = Array.isArray(profile.mechanic_profiles) ? profile.mechanic_profiles[0] : profile.mechanic_profiles;
  const currentStatus = mp?.verification_status || 'pending_verification';

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{value?.toString() || '-'}</Text>
    </View>
  );

  const ActionButton = ({ label, color, onPress, disabled }: { label: string; color: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={actionLoading || disabled}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: color,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
        opacity: actionLoading || disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{profile.full_name || 'Unknown'}</Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: (STATUS_COLORS[currentStatus] || colors.textSecondary) + '20',
            alignSelf: 'flex-start',
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 11, color: STATUS_COLORS[currentStatus] || colors.textSecondary, fontWeight: '600' }}>
              {currentStatus.toUpperCase().replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Section title="Profile">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Location" value={profile.city && profile.state ? `${profile.city}, ${profile.state}` : null} />
            <InfoRow label="Experience" value={mp?.years_experience ? `${mp.years_experience} years` : null} />
            {mp?.bio && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Bio</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{mp.bio}</Text>
              </View>
            )}
            {mp?.verification_reason && (
              <View style={{ marginTop: spacing.sm, backgroundColor: '#F59E0B10', padding: spacing.sm, borderRadius: 4 }}>
                <Text style={{ color: '#F59E0B', fontSize: 12 }}>Reason: {mp.verification_reason}</Text>
              </View>
            )}
          </View>
        </Section>

        {verificationStatus && (
          <Section title="Verification Progress">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <InfoRow label="Documents Uploaded" value={`${verificationStatus.documents_uploaded}/${verificationStatus.documents_required}`} />
              <InfoRow label="Documents Approved" value={verificationStatus.documents_approved} />
              <InfoRow label="Vetting Responses" value={`${verificationStatus.vetting_responses}/${verificationStatus.vetting_required}`} />
              <InfoRow label="Tier" value={verificationStatus.tier} />
              <InfoRow label="Can View Leads" value={verificationStatus.can_view_leads ? 'Yes' : 'No'} />
              <InfoRow label="Can Submit Quotes" value={verificationStatus.can_submit_quotes ? 'Yes' : 'No'} />
            </View>
          </Section>
        )}

        <Section title="Actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {currentStatus === 'pending_verification' && (
              <>
                <ActionButton label="Activate" color="#10B981" onPress={() => confirmStatusChange('active', 'Activate')} />
                <ActionButton label="Remove" color="#EF4444" onPress={() => confirmStatusChange('removed', 'Remove')} />
              </>
            )}
            {currentStatus === 'active' && (
              <>
                <ActionButton label="Pause" color="#6B7280" onPress={() => confirmStatusChange('paused', 'Pause')} />
                <ActionButton label="Remove" color="#EF4444" onPress={() => confirmStatusChange('removed', 'Remove')} />
              </>
            )}
            {currentStatus === 'paused' && (
              <>
                <ActionButton label="Reactivate" color="#10B981" onPress={() => confirmStatusChange('active', 'Reactivate')} />
                <ActionButton label="Remove" color="#EF4444" onPress={() => confirmStatusChange('removed', 'Remove')} />
              </>
            )}
            {currentStatus === 'removed' && (
              <ActionButton label="Reactivate" color="#10B981" onPress={() => confirmStatusChange('active', 'Reactivate')} />
            )}
          </View>
        </Section>

        <Section title="Tier Management">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm }}>
              Current Tier: <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{verificationStatus?.tier || 'probation'}</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(MECHANIC_TIER) as Array<keyof typeof MECHANIC_TIER>).map(key => {
                const tierValue = MECHANIC_TIER[key];
                const isCurrentTier = verificationStatus?.tier === tierValue;
                const tierColor = MECHANIC_TIER_COLORS[tierValue];
                return (
                  <TouchableOpacity
                    key={tierValue}
                    onPress={() => {
                      if (isCurrentTier) return;
                      Alert.alert(
                        'Change Tier',
                        `Set mechanic tier to ${MECHANIC_TIER_LABELS[tierValue]}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Confirm',
                            onPress: async () => {
                              setActionLoading(true);
                              const result = await adminSetMechanicTier(id!, tierValue);
                              setActionLoading(false);
                              if (result.success) {
                                Alert.alert('Success', `Tier changed to ${MECHANIC_TIER_LABELS[tierValue]}`);
                                fetchData();
                              } else {
                                Alert.alert('Error', result.error || 'Failed to change tier');
                              }
                            }
                          },
                        ]
                      );
                    }}
                    disabled={actionLoading || isCurrentTier}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: 8,
                      backgroundColor: isCurrentTier ? tierColor : colors.background,
                      borderWidth: 1,
                      borderColor: isCurrentTier ? tierColor : colors.border,
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    <Text style={{
                      color: isCurrentTier ? '#fff' : colors.textPrimary,
                      fontWeight: '600',
                      fontSize: 13
                    }}>
                      {MECHANIC_TIER_LABELS[tierValue]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title={`Documents (${documents.length})`}>
          {documents.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>No documents uploaded</Text>
          ) : (
            documents.map(doc => (
              <View key={doc.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{doc.doc_type.replace(/_/g, ' ')}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: (STATUS_COLORS[doc.status] || colors.textSecondary) + '20',
                  }}>
                    <Text style={{ fontSize: 11, color: STATUS_COLORS[doc.status] || colors.textSecondary, fontWeight: '600' }}>
                      {doc.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                {documentUrls[doc.id] && (
                  <Image
                    source={{ uri: documentUrls[doc.id] }}
                    style={{ width: '100%', height: 200, borderRadius: 8, marginTop: spacing.sm }}
                    resizeMode="contain"
                  />
                )}
                
                {doc.review_notes && (
                  <Text style={{ color: '#EF4444', fontSize: 12, marginTop: spacing.sm }}>
                    Notes: {doc.review_notes}
                  </Text>
                )}
                
                {doc.status === 'pending' && (
                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <ActionButton label="Approve" color="#10B981" onPress={() => handleApproveDocument(doc.id)} />
                    <ActionButton label="Reject" color="#EF4444" onPress={() => handleRejectDocument(doc.id)} />
                  </View>
                )}
              </View>
            ))
          )}
        </Section>

        {vettingResponses.length > 0 && (
          <Section title={`Vetting Responses (${vettingResponses.length})`}>
            {vettingResponses.map(response => (
              <View key={response.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{response.prompt_text}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: spacing.sm }}>{response.response_text}</Text>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}
