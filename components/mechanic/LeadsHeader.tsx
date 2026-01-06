import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import type { LeadsSummary, LeadSortType } from '@/src/types/mechanic-leads';

interface LeadsHeaderProps {
  summary: LeadsSummary | null;
  sortBy: LeadSortType;
  onChangeSortBy: (sortBy: LeadSortType) => void;
}

export function LeadsHeader({ summary, sortBy, onChangeSortBy }: LeadsHeaderProps) {
  const { colors } = useTheme();

  const sortOptions: { value: LeadSortType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'newest', label: 'Newest', icon: 'time-outline' },
    { value: 'closest', label: 'Closest', icon: 'location-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {summary && (
        <View style={styles.summaryRow}>
          <View key="summary-all" style={styles.summaryItem}>
            <View style={[styles.summaryBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="briefcase" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.summaryCount, { color: colors.primary }]}>{summary.all_count}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Open Leads</Text>
          </View>
          <View key="divider-1" style={[styles.divider, { backgroundColor: colors.gray }]} />
          <View key="summary-nearby" style={styles.summaryItem}>
            <View style={[styles.summaryBadge, { backgroundColor: colors.blueBg }]}>
              <Ionicons name="location" size={20} color={colors.blue} />
            </View>
            <Text style={[styles.summaryCount, { color: colors.blue }]}>{summary.nearby_count}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Nearby</Text>
          </View>
          <View key="divider-2" style={[styles.divider, { backgroundColor: colors.gray }]} />
          <View key="summary-quoted" style={styles.summaryItem}>
            <View style={[styles.summaryBadge, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            </View>
            <Text style={[styles.summaryCount, { color: colors.green }]}>{summary.quoted_count}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Quoted</Text>
          </View>
        </View>
      )}

      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by:</Text>
        <View style={styles.sortButtons}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortButton,
                sortBy === option.value && { backgroundColor: colors.accent },
                sortBy !== option.value && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => onChangeSortBy(option.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={sortBy === option.value ? colors.bg : colors.textMuted}
              />
              <Text
                style={[
                  styles.sortButtonText,
                  sortBy === option.value && styles.sortButtonTextActive,
                  sortBy !== option.value && { color: colors.textMuted },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 11,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  divider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
});
