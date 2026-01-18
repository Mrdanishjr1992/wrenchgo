import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/ui/theme-context';
import {
  VERIFICATION_DOC_TYPES,
  VERIFICATION_DOC_LABELS,
  VERIFICATION_DOC_HINTS,
  VERIFICATION_STATUS_LABELS,
  VETTING_PROMPTS,
  MECHANIC_TIER_LABELS,
  MECHANIC_TIER_COLORS,
  MECHANIC_TIER_DESCRIPTIONS,
  type VerificationDocType,
} from '@/src/constants/verification';
import {
  getVerificationStatus,
  getVerificationDocuments,
  uploadVerificationDocument,
  getVettingResponses,
  saveVettingResponse,
  formatProbationLimits,
  type VerificationStatus,
  type VerificationDocument,
} from '@/src/lib/verification';

interface VerificationSectionProps {
  mechanicId: string;
  onStatusChange?: (isActive: boolean) => void;
}

export function VerificationSection({ mechanicId, onStatusChange }: VerificationSectionProps) {
  const { colors, spacing, radius } = useTheme();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<VerificationDocType | null>(null);
  const [savingVetting, setSavingVetting] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [vettingResponses, setVettingResponses] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusData, docsData, vettingData] = await Promise.all([
        getVerificationStatus(mechanicId),
        getVerificationDocuments(mechanicId),
        getVettingResponses(mechanicId),
      ]);
      setStatus(statusData);
      setDocuments(docsData);
      const responses: Record<string, string> = {};
      vettingData.forEach((r) => {
        responses[r.prompt_key] = r.response_text;
      });
      setVettingResponses(responses);
      if (statusData && onStatusChange) {
        onStatusChange(statusData.is_active);
      }
    } catch (e) {
      console.error('Error loading verification data:', e);
    } finally {
      setLoading(false);
    }
  }, [mechanicId, onStatusChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUploadDoc = async (docType: VerificationDocType, useCamera: boolean = false) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Please allow access to your camera.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Please allow access to your photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      }
      if (result.canceled) return;

      setUploading(docType);
      const uri = result.assets[0].uri;
      const contentType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const res = await uploadVerificationDocument(mechanicId, docType, uri, contentType);
      if (res.success) {
        Alert.alert('Success', 'Document uploaded. It will be reviewed shortly.');
        await load();
      } else {
        Alert.alert('Error', res.error || 'Failed to upload document.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload document.');
    } finally {
      setUploading(null);
    }
  };

  const showUploadOptions = (docType: VerificationDocType) => {
    if (docType === VERIFICATION_DOC_TYPES.SELFIE_WITH_ID) {
      Alert.alert(
        'Upload Selfie',
        'Take a photo holding your ID next to your face',
        [
          { text: 'Take Photo', onPress: () => handleUploadDoc(docType, true) },
          { text: 'Choose from Library', onPress: () => handleUploadDoc(docType, false) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      handleUploadDoc(docType, false);
    }
  };

  const handleSaveVetting = async (promptKey: string, promptText: string) => {
    const response = vettingResponses[promptKey];
    const prompt = VETTING_PROMPTS.find((p) => p.key === promptKey);
    if (!response || (prompt && response.length < prompt.minLength)) {
      Alert.alert('Error', `Please provide a more detailed response (at least ${prompt?.minLength || 30} characters).`);
      return;
    }
    setSavingVetting(promptKey);
    try {
      const res = await saveVettingResponse(mechanicId, promptKey, promptText, response);
      if (res.success) {
        Alert.alert('Saved', 'Your response has been saved.');
        await load();
      } else {
        Alert.alert('Error', res.error || 'Failed to save response.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save response.');
    } finally {
      setSavingVetting(null);
    }
  };

  const getDocByType = (docType: VerificationDocType) => documents.find((d) => d.doc_type === docType);

  const getStatusIcon = (docStatus?: string) => {
    if (!docStatus || docStatus === 'pending') return { name: 'time-outline' as const, color: colors.warning || '#D97706' };
    if (docStatus === 'approved') return { name: 'checkmark-circle' as const, color: colors.success || '#10B981' };
    return { name: 'close-circle' as const, color: colors.error || '#EF4444' };
  };

  const overallStatusColor = status?.is_active
    ? colors.success || '#10B981'
    : status?.status === 'paused'
    ? colors.warning || '#D97706'
    : colors.textMuted;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Ionicons name="shield-checkmark-outline" size={24} color={overallStatusColor} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Verification</Text>
            <Text style={[styles.subtitle, { color: overallStatusColor }]}>
              {status ? VERIFICATION_STATUS_LABELS[status.status as keyof typeof VERIFICATION_STATUS_LABELS] || status.status : 'Loading...'}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Always visible: Status banner and Tier section */}
      <View style={styles.content}>
        {status?.is_active ? (
          <View style={[styles.statusBanner, { backgroundColor: (colors.success || '#10B981') + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success || '#10B981'} />
            <Text style={[styles.statusText, { color: colors.success || '#10B981' }]}>
              Your account is verified and active
            </Text>
          </View>
        ) : status?.status === 'paused' ? (
          <View style={[styles.statusBanner, { backgroundColor: (colors.error || '#EF4444') + '20' }]}>
            <Ionicons name="pause-circle" size={20} color={colors.error || '#EF4444'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusText, { color: colors.error || '#EF4444' }]}>
                Account Paused
              </Text>
              {status?.reason && (
                <Text style={[styles.statusSubtext, { color: colors.error || '#EF4444' }]}>
                  {status.reason}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.statusBanner, { backgroundColor: (colors.warning || '#D97706') + '20' }]}>
            <Ionicons name="information-circle" size={20} color={colors.warning || '#D97706'} />
            <Text style={[styles.statusText, { color: colors.warning || '#D97706' }]}>
              Complete verification to access leads
            </Text>
          </View>
        )}

        {/* Tier Display */}
        {status?.is_active && status?.tier && (
          <View style={[styles.tierSection, { borderColor: colors.border }]}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierBadge, { backgroundColor: MECHANIC_TIER_COLORS[status.tier] + '20' }]}>
                <Ionicons
                  name={status.tier === 'trusted' ? 'star' : status.tier === 'standard' ? 'shield-checkmark' : 'time'}
                  size={16}
                  color={MECHANIC_TIER_COLORS[status.tier]}
                />
                <Text style={[styles.tierLabel, { color: MECHANIC_TIER_COLORS[status.tier] }]}>
                  {MECHANIC_TIER_LABELS[status.tier]} Tier
                </Text>
              </View>
              {status.strike_count > 0 && (
                <View style={[styles.strikeBadge, { backgroundColor: colors.error + '20' }]}>
                  <Ionicons name="warning" size={14} color={colors.error} />
                  <Text style={[styles.strikeCount, { color: colors.error }]}>
                    {status.strike_count} Strike{status.strike_count > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tierDescription, { color: colors.textMuted }]}>
              {MECHANIC_TIER_DESCRIPTIONS[status.tier]}
            </Text>

            {/* Probation Limits */}
            {status.tier === 'probation' && (
              <View style={[styles.limitsContainer, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.limitsTitle, { color: colors.textPrimary }]}>
                  <Ionicons name="lock-closed" size={14} color={colors.warning} /> Probation Limits
                </Text>
                {formatProbationLimits(status).map((limit, idx) => (
                  <View key={idx} style={styles.limitRow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    <Text style={[styles.limitText, { color: colors.textMuted }]}>{limit}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Expanded only: Required Documents and Vetting Questions */}
        {expanded && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Required Documents</Text>
            {Object.values(VERIFICATION_DOC_TYPES).map((docType) => {
              const doc = getDocByType(docType);
              const icon = getStatusIcon(doc?.status);
              const hint = VERIFICATION_DOC_HINTS[docType];
              return (
                <View key={docType} style={[styles.docRow, { borderColor: colors.border }]}>
                  <View style={styles.docInfo}>
                    <Ionicons name={icon.name} size={20} color={icon.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docLabel, { color: colors.textPrimary }]}>{VERIFICATION_DOC_LABELS[docType]}</Text>
                      {hint && !doc && (
                        <Text style={[styles.docHint, { color: colors.textMuted }]}>{hint}</Text>
                      )}
                    </View>
                  </View>
                  {doc?.status === 'approved' ? (
                    <Text style={[styles.docStatus, { color: colors.success || '#10B981' }]}>Approved</Text>
                  ) : doc?.status === 'rejected' ? (
                    <TouchableOpacity
                      style={[styles.uploadBtn, { backgroundColor: colors.error || '#EF4444' }]}
                      onPress={() => showUploadOptions(docType)}
                      disabled={uploading === docType}
                    >
                      {uploading === docType ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.uploadBtnText}>Re-upload</Text>
                      )}
                    </TouchableOpacity>
                  ) : doc ? (
                    <Text style={[styles.docStatus, { color: colors.warning || '#D97706' }]}>Pending Review</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadBtn, { backgroundColor: colors.accent }]}
                      onPress={() => showUploadOptions(docType)}
                      disabled={uploading === docType}
                    >
                      {uploading === docType ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.uploadBtnText}>Upload</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.lg }]}>
              Vetting Questions ({status?.vetting_responses || 0}/{status?.vetting_required || 5})
            </Text>
            {VETTING_PROMPTS.map((prompt, idx) => {
              const saved = documents.length > 0 || status?.vetting_responses ? vettingResponses[prompt.key] : undefined;
              const existingResponse = vettingResponses[prompt.key] || '';
              return (
                <View key={prompt.key} style={[styles.vettingItem, { borderColor: colors.border }]}>
                  <Text style={[styles.vettingPrompt, { color: colors.textPrimary }]}>
                    {idx + 1}. {prompt.text}
                  </Text>
                  <TextInput
                    style={[
                      styles.vettingInput,
                      { backgroundColor: colors.surface2, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder={prompt.placeholder}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    value={existingResponse}
                    onChangeText={(text) => setVettingResponses((prev) => ({ ...prev, [prompt.key]: text }))}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: existingResponse.length >= prompt.minLength ? colors.accent : colors.surface2 },
                    ]}
                    onPress={() => handleSaveVetting(prompt.key, prompt.text)}
                    disabled={savingVetting === prompt.key || existingResponse.length < prompt.minLength}
                  >
                    {savingVetting === prompt.key ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.saveBtnText, { color: existingResponse.length >= prompt.minLength ? '#fff' : colors.textMuted }]}>
                        {saved ? 'Update' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {status?.reason && (
              <View style={[styles.reasonBox, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.reasonLabel, { color: colors.textMuted }]}>Admin Note:</Text>
                <Text style={[styles.reasonText, { color: colors.textPrimary }]}>{status.reason}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginVertical: 8, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { marginLeft: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  content: { marginTop: 16 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, marginBottom: 16 },
  statusText: { fontSize: 14, fontWeight: '500', flex: 1 },
  statusSubtext: { fontSize: 12, marginTop: 2, opacity: 0.9 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  docLabel: { fontSize: 14 },
  docHint: { fontSize: 12, marginTop: 2 },
  docStatus: { fontSize: 13, fontWeight: '500' },
  uploadBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  vettingItem: { paddingVertical: 12, borderBottomWidth: 1 },
  vettingPrompt: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
  vettingInput: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14 },
  saveBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  saveBtnText: { fontSize: 13, fontWeight: '600' },
  reasonBox: { marginTop: 16, padding: 12, borderRadius: 8 },
  reasonLabel: { fontSize: 12, marginBottom: 4 },
  reasonText: { fontSize: 14 },
  // Tier styles
  tierSection: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tierLabel: { fontSize: 14, fontWeight: '600' },
  tierDescription: { fontSize: 13, lineHeight: 18 },
  strikeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  strikeCount: { fontSize: 12, fontWeight: '600' },
  limitsContainer: { marginTop: 12, padding: 12, borderRadius: 8 },
  limitsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  limitText: { fontSize: 13 },
});