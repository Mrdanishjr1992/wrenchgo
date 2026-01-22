import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';

type ReviewPromptBannerProps = {
  jobId: string;
  targetName: string;
  expiresAt: string;
  userRole: 'customer' | 'mechanic';
};

export default function ReviewPromptBanner({
  jobId,
  targetName,
  expiresAt,
  userRole,
}: ReviewPromptBannerProps) {
  const { colors, text, spacing } = useTheme();
  const router = useRouter();

  const getDaysRemaining = () => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const daysRemaining = getDaysRemaining();

  const handlePress = () => {
    if (userRole === 'customer') {
      router.push(`/(customer)/submit-review/${jobId}`);
    } else {
      router.push(`/(mechanic)/submit-review/${jobId}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: colors.primary + '15',
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="star-outline" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[text.base, { fontWeight: '600', color: colors.text }]}>
            Review {targetName}
          </Text>
          <Text style={[text.sm, { color: colors.textSecondary, marginTop: 2 }]}>
            {daysRemaining > 0
              ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
              : 'Expires today'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
}
