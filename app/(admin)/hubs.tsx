import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminGetHubs, AdminHub } from '../../src/lib/admin';

export default function AdminHubsScreen() {
  const { colors } = useTheme();
  const [hubs, setHubs] = useState<AdminHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHubs = useCallback(async () => {
    try {
      const data = await adminGetHubs();
      setHubs(data);
    } catch (error) {
      console.error('Error fetching hubs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchHubs(); }, [fetchHubs]));

  const onRefresh = () => { setRefreshing(true); fetchHubs(); };

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Service Hubs</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {hubs.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No hubs found</Text>
        ) : (
          hubs.map(hub => (
            <TouchableOpacity
              key={hub.id}
              onPress={() => router.push(`/(admin)/hubs/${hub.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{hub.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {hub.invite_only && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F59E0B20' }}>
                      <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '600' }}>INVITE ONLY</Text>
                    </View>
                  )}
                  {hub.auto_expand_enabled && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#10B98120' }}>
                      <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '600' }}>AUTO EXPAND</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {hub.city && hub.state ? `${hub.city}, ${hub.state}` : hub.zip || 'Unknown location'}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.accent }}>{hub.active_mechanics}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Mechanics</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{hub.jobs_last_14d}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Jobs (14d)</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{hub.active_radius_miles}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Radius (mi)</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
