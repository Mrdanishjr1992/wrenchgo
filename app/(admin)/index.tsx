import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/ui/theme-context';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';
import { ThemedBadge } from '../../src/ui/components/ThemedBadge';

interface AdminCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  delay?: number;
}

function AdminCard({ title, description, icon, color, route, delay = 0 }: AdminCardProps) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <Pressable
        onPress={() => router.push(route as any)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <ThemedCard style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderLeftWidth: 4,
          borderLeftColor: color,
        }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(color, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: '600' }}>{title}</ThemedText>
            <ThemedText variant="caption" style={{ marginTop: 2 }}>{description}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </ThemedCard>
      </Pressable>
    </Animated.View>
  );
}

export default function AdminHomeScreen() {
  const { colors, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const sections = [
    {
      title: 'Operations',
      items: [
        { title: 'Verification', description: 'Review mechanic applications', icon: 'shield-checkmark' as const, color: colors.success, route: '/(admin)/verification' },
        { title: 'Disputes', description: 'Manage customer disputes', icon: 'alert-circle' as const, color: colors.error, route: '/(admin)/disputes' },
        { title: 'Support', description: 'Handle support tickets', icon: 'chatbubbles' as const, color: colors.secondary || colors.primary, route: '/(admin)/support' },
        { title: 'Jobs', description: 'View and manage jobs', icon: 'construct' as const, color: colors.primary, route: '/(admin)/jobs' },
        { title: 'Mechanics', description: 'Manage mechanic profiles', icon: 'build' as const, color: colors.warning, route: '/(admin)/mechanics' },
        { title: 'Customers', description: 'View customer profiles', icon: 'people' as const, color: colors.info || colors.primary, route: '/(admin)/customers' },
      ],
    },
    {
      title: 'Financials',
      items: [
        { title: 'Payments', description: 'View customer payments', icon: 'card' as const, color: colors.success, route: '/(admin)/payments' },
        { title: 'Payouts', description: 'View mechanic payouts', icon: 'cash' as const, color: colors.primary, route: '/(admin)/payouts' },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { title: 'Metrics', description: 'Platform performance metrics', icon: 'stats-chart' as const, color: colors.accent || colors.primary, route: '/(admin)/metrics' },
        { title: 'Hubs', description: 'Hub health & expansion', icon: 'location' as const, color: colors.success, route: '/(admin)/hubs' },
        { title: 'Waitlist', description: 'Demand heatmap by area', icon: 'map' as const, color: colors.warning, route: '/(admin)/waitlist' },
      ],
    },
  ];

  let delayCounter = 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.primaryDark || colors.primary, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.lg,
          ...shadows.md,
        }}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <Pressable 
            onPress={() => router.back()} 
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ThemedText variant="title" style={{ color: colors.white, fontSize: 24 }}>
              Admin Console
            </ThemedText>
            <ThemedBadge label="ADMIN" variant="error" size="sm" />
          </View>
          <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            Platform operations & analytics
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, idx) => (
          <View key={idx} style={{ marginBottom: spacing.xl }}>
            <Animated.View entering={FadeInDown.delay(idx * 50).duration(300)}>
              <ThemedText 
                variant="label" 
                style={{ 
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: spacing.md,
                  marginLeft: spacing.xs,
                }}
              >
                {section.title}
              </ThemedText>
            </Animated.View>
            {section.items.map((item, itemIdx) => {
              delayCounter += 50;
              return <AdminCard key={itemIdx} {...item} delay={delayCounter} />;
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}