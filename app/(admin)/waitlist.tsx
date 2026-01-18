import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetWaitlistHeatmap, WaitlistHeatmap } from '../../src/lib/admin';

export default function AdminWaitlistScreen() {
  const { colors } = useTheme();
  const [heatmap, setHeatmap] = useState<WaitlistHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetWaitlistHeatmap(undefined, periodDays);
      setHeatmap(data);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useFocusEffect(useCallback(() => { fetchHeatmap(); }, [fetchHeatmap]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Waitlist Demand</Text>
        <TouchableOpacity onPress={fetchHeatmap}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
          Time Period
        </Text>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
        {[14, 30, 60, 90].map(days => (
          <TouchableOpacity
            key={days}
            onPress={() => setPeriodDays(days)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: 20,
              backgroundColor: periodDays === days ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: periodDays === days ? colors.accent : colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: periodDays === days ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{days}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {heatmap && (
          <>
            {/* Total */}
            <View style={{ 
              backgroundColor: colors.surface, 
              borderRadius: 16, 
              padding: spacing.lg, 
              marginBottom: spacing.lg,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: colors.accent }}>{heatmap.total}</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Total Signups ({periodDays} days)</Text>
            </View>

            {/* By User Type */}
            {heatmap.by_user_type && heatmap.by_user_type.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>By User Type</Text>
                <View style={{ flexDirection: 'row', marginBottom: spacing.lg, gap: spacing.sm }}>
                  {heatmap.by_user_type.map((item, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontWeight: '900', color: item.user_type === 'customer' ? '#3B82F6' : '#10B981' }}>{item.count}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, textTransform: 'capitalize' }}>{item.user_type}s</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* By Hub */}
            {heatmap.by_hub && heatmap.by_hub.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>By Nearest Hub</Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, marginBottom: spacing.lg }}>
                  {heatmap.by_hub.map((item, i) => (
                    <TouchableOpacity 
                      key={i} 
                      onPress={() => item.hub_id && router.push(`/(admin)/hubs/${item.hub_id}`)}
                      style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: spacing.md,
                        borderBottomWidth: i < heatmap.by_hub.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{item.hub_name || 'No Hub'}</Text>
                      </View>
                      <View style={{ 
                        backgroundColor: colors.accent + '20', 
                        paddingHorizontal: 12, 
                        paddingVertical: 4, 
                        borderRadius: 12,
                      }}>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>{item.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* By Zip */}
            {heatmap.by_zip && heatmap.by_zip.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm }}>Top Zip Codes</Text>
                <View style={{ backgroundColor: colors.surface, borderRadius: 12 }}>
                  {heatmap.by_zip.slice(0, 15).map((item, i) => {
                    const maxCount = heatmap.by_zip[0]?.count || 1;
                    const barWidth = Math.max((item.count / maxCount) * 100, 5);
                    
                    return (
                      <View 
                        key={i} 
                        style={{ 
                          padding: spacing.md,
                          borderBottomWidth: i < Math.min(heatmap.by_zip.length, 15) - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View>
                            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{item.zip}</Text>
                            {(item.city || item.state) && (
                              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                                {[item.city, item.state].filter(Boolean).join(', ')}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: colors.textSecondary }}>{item.count} signups</Text>
                        </View>
                        <View style={{ 
                          height: 6, 
                          backgroundColor: colors.border, 
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}>
                          <View style={{ 
                            width: `${barWidth}%`, 
                            height: '100%', 
                            backgroundColor: colors.accent,
                            borderRadius: 3,
                          }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {heatmap.total === 0 && (
              <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No waitlist signups in this period</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
