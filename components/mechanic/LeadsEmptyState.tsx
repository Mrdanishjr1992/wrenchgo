import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import type { LeadFilterType } from '@/src/types/mechanic-leads';

interface LeadsEmptyStateProps {
  filter: LeadFilterType;
  onEnableLocation?: () => void;
  onIncreaseRadius?: () => void;
}

export function LeadsEmptyState({ filter, onEnableLocation, onIncreaseRadius }: LeadsEmptyStateProps) {
  const { colors } = useTheme();

  const getEmptyStateContent = () => {
    switch (filter) {
      case 'all':
        return {
          icon: 'briefcase-outline' as const,
          title: 'No leads available',
          message: 'Check back soon for new job opportunities in your area.',
        };
      case 'nearby':
        return {
          icon: 'location-outline' as const,
          title: 'No nearby leads',
          message: 'Try increasing your service radius or enable location services to see more opportunities.',
        };
      case 'quoted':
        return {
          icon: 'document-text-outline' as const,
          title: 'No quotes yet',
          message: "You haven't submitted any quotes yet. Browse available leads to get started!",
        };
      default:
        return {
          icon: 'briefcase-outline' as const,
          title: 'No leads',
          message: 'No leads available at this time.',
        };
    }
  };

  const content = getEmptyStateContent();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
        <Ionicons name={content.icon} size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{content.title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{content.message}</Text>
    </View>
  );
}

export function LeadCardSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonCustomerInfo}>
          <View style={[styles.skeletonAvatar, { backgroundColor: colors.surface2 }]} />
          <View style={styles.skeletonCustomerDetails}>
            <View style={[styles.skeletonName, { backgroundColor: colors.surface2 }]} />
            <View style={[styles.skeletonRating, { backgroundColor: colors.surface2 }]} />
          </View>
        </View>
        <View style={[styles.skeletonTime, { backgroundColor: colors.surface2 }]} />
      </View>

      <View style={[styles.skeletonTitle, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.skeletonDescription, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.skeletonDescriptionShort, { backgroundColor: colors.surface2 }]} />

      <View style={[styles.skeletonVehicle, { backgroundColor: colors.surface2 }]} />

      <View style={styles.skeletonActions}>
        <View style={[styles.skeletonButton, { backgroundColor: colors.surface2 }]} />
        <View style={[styles.skeletonButton, { backgroundColor: colors.surface2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeletonCustomerInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  skeletonCustomerDetails: {
    flex: 1,
  },
  skeletonName: {
    width: '60%',
    height: 16,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonRating: {
    width: '40%',
    height: 12,
    borderRadius: 4,
  },
  skeletonTime: {
    width: 50,
    height: 12,
    borderRadius: 4,
  },
  skeletonTitle: {
    width: '90%',
    height: 18,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonDescription: {
    width: '100%',
    height: 14,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonDescriptionShort: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonVehicle: {
    width: 140,
    height: 28,
    borderRadius: 6,
    marginBottom: 12,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
  },
});
