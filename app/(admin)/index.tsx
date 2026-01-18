import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';

interface AdminCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}

function AdminCard({ title, description, icon, color, route }: AdminCardProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push(route as any)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: color + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
      }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function AdminHomeScreen() {
  const { colors } = useTheme();

  const sections = [
    {
      title: 'Operations',
      items: [
        { title: 'Verification', description: 'Review mechanic applications', icon: 'shield-checkmark' as const, color: '#10B981', route: '/(admin)/verification' },
        { title: 'Disputes', description: 'Manage customer disputes', icon: 'alert-circle' as const, color: '#EF4444', route: '/(admin)/disputes' },
        { title: 'Support', description: 'Handle support tickets', icon: 'chatbubbles' as const, color: '#8B5CF6', route: '/(admin)/support' },
        { title: 'Jobs', description: 'View and manage jobs', icon: 'construct' as const, color: '#3B82F6', route: '/(admin)/jobs' },
        { title: 'Mechanics', description: 'Manage mechanic profiles', icon: 'build' as const, color: '#F59E0B', route: '/(admin)/mechanics' },
        { title: 'Customers', description: 'View customer profiles', icon: 'people' as const, color: '#06B6D4', route: '/(admin)/customers' },
      ],
    },
    {
      title: 'Financials',
      items: [
        { title: 'Payments', description: 'View customer payments', icon: 'card' as const, color: '#10B981', route: '/(admin)/payments' },
        { title: 'Payouts', description: 'View mechanic payouts', icon: 'cash' as const, color: '#6366F1', route: '/(admin)/payouts' },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { title: 'Metrics', description: 'Platform performance metrics', icon: 'stats-chart' as const, color: '#EC4899', route: '/(admin)/metrics' },
        { title: 'Hubs', description: 'Hub health & expansion', icon: 'location' as const, color: '#14B8A6', route: '/(admin)/hubs' },
        { title: 'Waitlist', description: 'Demand heatmap by area', icon: 'map' as const, color: '#F97316', route: '/(admin)/waitlist' },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: '#1E1B4B',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>Admin Console</Text>
            <View style={{ 
              backgroundColor: '#EF4444', 
              paddingHorizontal: 8, 
              paddingVertical: 2, 
              borderRadius: 4, 
              marginLeft: spacing.sm 
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: '#A5B4FC', marginTop: 2 }}>Platform operations & analytics</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {sections.map((section, idx) => (
          <View key={idx} style={{ marginBottom: spacing.xl }}>
            <Text style={{ 
              fontSize: 12, 
              fontWeight: '700', 
              color: colors.textSecondary, 
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: spacing.md,
            }}>
              {section.title}
            </Text>
            {section.items.map((item, itemIdx) => (
              <AdminCard key={itemIdx} {...item} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}