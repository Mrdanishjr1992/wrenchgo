import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { spacing } from '../../../src/ui/theme';
import { adminGetHubDetail, adminGetHubReadiness, adminUpdateHub, formatDateTime, HubReadinessMetrics } from '../../../src/lib/admin';

interface HubDetail {
  hub: {
    id: string;
    name: string;
    slug: string;
    zip: string;
    lat: number;
    lng: number;
    max_radius_miles: number;
    active_radius_miles: number;
    is_active: boolean;
    invite_only: boolean;
    auto_expand_enabled: boolean;
    launch_date: string | null;
    graduated_at: string | null;
    settings: Record<string, any>;
    created_at: string;
  };
  stats: {
    mechanics: number;
    customers: number;
    jobs: number;
  };
}

export default function AdminHubDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<HubDetail | null>(null);
  const [readiness, setReadiness] = useState<HubReadinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [isActive, setIsActive] = useState(false);
  const [activeRadius, setActiveRadius] = useState(15);
  const [maxRadius, setMaxRadius] = useState(25);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setError(null);
        Promise.all([
          adminGetHubDetail(id),
          adminGetHubReadiness(id),
        ])
          .then(([hubData, readinessData]) => {
            setDetail(hubData);
            setReadiness(readinessData);
            setIsActive(hubData.hub.is_active);
            setActiveRadius(hubData.hub.active_radius_miles);
            setMaxRadius(hubData.hub.max_radius_miles);
          })
          .catch((err) => {
            console.error('Error:', err);
            setError(err?.message || 'Failed to load hub');
          })
          .finally(() => setLoading(false));
      }
    }, [id])
  );

  const handleSave = async () => {
    if (!id || !detail) return;

    if (activeRadius > maxRadius) {
      Alert.alert('Error', 'Active radius cannot exceed max radius');
      return;
    }

    setSaving(true);
    try {
      const updated = await adminUpdateHub(id, {
        is_active: isActive,
        active_radius_miles: activeRadius,
        max_radius_miles: maxRadius,
      });
      setDetail({ ...detail, hub: updated });
      Alert.alert('Success', 'Hub settings updated');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update hub');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = detail && (
    isActive !== detail.hub.is_active ||
    activeRadius !== detail.hub.active_radius_miles ||
    maxRadius !== detail.hub.max_radius_miles
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
        <Text style={{ color: colors.textSecondary }}>{error || 'Hub not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { hub, stats } = detail;

  const getReadinessColor = (score: number): string => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | boolean | null | undefined }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>
        {value === true ? 'Yes' : value === false ? 'No' : (value?.toString() || '-')}
      </Text>
    </View>
  );

  const StatCard = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: color || colors.accent }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );

  const ReadinessItem = ({ icon, label, value, target, met }: { icon: string; label: string; value: string | number; target: string; met: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon as any} size={16} color={met ? '#10B981' : colors.textSecondary} />
        <Text style={{ marginLeft: 8, color: colors.textPrimary, fontSize: 14 }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{value}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>({target})</Text>
        <Ionicons name={met ? 'checkmark-circle' : 'close-circle'} size={16} color={met ? '#10B981' : '#EF4444'} />
      </View>
    </View>
  );

  const MetricPill = ({ label, value }: { label: string; value: string | number }) => (
    <View style={{ backgroundColor: colors.background, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{value}</Text></Text>
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{hub.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {!hub.is_active && (
              <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600' }}>INACTIVE</Text>
              </View>
            )}
            {hub.invite_only && (
              <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '600' }}>INVITE ONLY</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <StatCard label="Mechanics" value={stats.mechanics} color="#3B82F6" />
          <StatCard label="Customers" value={stats.customers} color="#10B981" />
          <StatCard label="Jobs" value={stats.jobs} color="#8B5CF6" />
        </View>

        <Section title="Hub Details">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Slug" value={hub.slug} />
            <InfoRow label="ZIP" value={hub.zip} />
            <InfoRow label="Coordinates" value={`${hub.lat.toFixed(4)}, ${hub.lng.toFixed(4)}`} />
            <InfoRow label="Created" value={formatDateTime(hub.created_at)} />
            {hub.launch_date && <InfoRow label="Launch Date" value={hub.launch_date} />}
            {hub.graduated_at && <InfoRow label="Graduated" value={formatDateTime(hub.graduated_at)} />}
          </View>
        </Section>

        <Section title="Hub Controls">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>Active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: colors.border, true: colors.accent + '80' }}
                thumbColor={isActive ? colors.accent : '#f4f3f4'}
              />
            </View>

            <View style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Active Radius (miles)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  onPress={() => setActiveRadius(Math.max(5, activeRadius - 5))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.background,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="remove" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>{activeRadius}</Text>
                <TouchableOpacity
                  onPress={() => setActiveRadius(Math.min(100, activeRadius + 5))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.background,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="add" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Max Radius (miles)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  onPress={() => setMaxRadius(Math.max(5, maxRadius - 5))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.background,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="remove" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>{maxRadius}</Text>
                <TouchableOpacity
                  onPress={() => setMaxRadius(Math.min(100, maxRadius + 5))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.background,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="add" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {hasChanges && (
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 8,
                  padding: spacing.md,
                  alignItems: 'center',
                  marginTop: spacing.sm,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Section>

        <Section title="Status">
          <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
            <InfoRow label="Invite Only" value={hub.invite_only} />
            <InfoRow label="Auto Expand" value={hub.auto_expand_enabled} />
          </View>
        </Section>

        {readiness && (
          <Section title="Expansion Readiness">
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md }}>
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: 36, fontWeight: '800', color: getReadinessColor(readiness.readiness_score) }}>
                  {readiness.readiness_score}%
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Readiness Score</Text>
              </View>

              <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.md }}>
                <View
                  style={{
                    height: '100%',
                    width: `${readiness.readiness_score}%`,
                    backgroundColor: getReadinessColor(readiness.readiness_score),
                    borderRadius: 4,
                  }}
                />
              </View>

              <View style={{ gap: spacing.sm }}>
                <ReadinessItem
                  icon="people"
                  label="Active Mechanics"
                  value={readiness.active_mechanics}
                  target="3+"
                  met={readiness.active_mechanics >= 3}
                />
                <ReadinessItem
                  icon="checkmark-circle"
                  label="Verified Mechanics"
                  value={readiness.verified_mechanics}
                  target="2+"
                  met={readiness.verified_mechanics >= 2}
                />
                <ReadinessItem
                  icon="construct"
                  label="Jobs (7 days)"
                  value={readiness.jobs_last_7_days}
                  target="5+"
                  met={readiness.jobs_last_7_days >= 5}
                />
                <ReadinessItem
                  icon="trending-up"
                  label="Completion Rate"
                  value={`${readiness.completion_rate}%`}
                  target="80%+"
                  met={readiness.completion_rate >= 80}
                />
                <ReadinessItem
                  icon="warning"
                  label="Dispute Rate"
                  value={`${readiness.dispute_rate}%`}
                  target="<5%"
                  met={readiness.dispute_rate <= 5}
                />
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                30-DAY METRICS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <MetricPill label="Jobs" value={readiness.jobs_last_30_days} />
                <MetricPill label="Completed" value={readiness.completed_jobs_30_days} />
                <MetricPill label="Cancelled" value={readiness.cancellations_30_days} />
                <MetricPill label="Disputes" value={readiness.disputes_30_days} />
                <MetricPill label="Waitlist" value={readiness.waitlist_count} />
                <MetricPill label="Avg Quotes/Job" value={readiness.avg_quotes_per_job} />
              </View>
            </View>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}