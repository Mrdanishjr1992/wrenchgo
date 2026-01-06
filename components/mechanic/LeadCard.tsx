import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import { getDisplayTitle } from '@/src/lib/format-symptom';
import type { MechanicLead } from '@/src/types/mechanic-leads';

interface LeadCardProps {
  lead: MechanicLead;
  onPressView: (jobId: string) => void;
  onPressQuote: (jobId: string) => void;
}

export function LeadCard({ lead, onPressView, onPressQuote }: LeadCardProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const getVehicleDisplay = (): string | null => {
    if (!lead.vehicle_year && !lead.vehicle_make && !lead.vehicle_model) return null;
    const parts = [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean);
    return parts.join(' ');
  };

  const parseJobDescription = (): { details: string[] } => {
    try {
      const parsed = JSON.parse(lead.description);
      const details: string[] = [];

      if (parsed.answers) {
        Object.entries(parsed.answers).forEach(([, value]: [string, any]) => {
          if (value && typeof value === 'object' && value.label) {
            details.push(value.label);
          } else if (value && typeof value === 'string') {
            details.push(value);
          }
        });
      }

      return { details: details.slice(0, 3) };
    } catch {
      return { details: [] };
    }
  };

  const vehicleDisplay = getVehicleDisplay();
  const { details } = parseJobDescription();

  return (
    <View
      style={[styles.card, {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        shadowColor: colors.textPrimary
      }]}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            {lead.is_new && (
              <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
            <Text style={[styles.timeAgo, { color: colors.textMuted }]}>
              {getTimeAgo(lead.created_at)}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {lead.distance_miles !== null && (
              <View style={styles.distanceChip}>
                <Ionicons name="location" size={14} color={colors.accent} />
                <Text style={[styles.distanceText, { color: colors.accent }]}>
                  {lead.distance_miles.toFixed(1)} mi
                </Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.textMuted}
              style={styles.chevron}
            />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={isExpanded ? undefined : 2}>
          {getDisplayTitle(lead.title)}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <>
          {details.length > 0 && (
            <View style={styles.detailsSection}>
              {details.map((detail, index) => (
                <View key={index} style={styles.detailRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.textMuted }]} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {detail}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.infoSection}>
            {vehicleDisplay && (
              <View style={styles.infoRow}>
                <Ionicons name="car-sport" size={16} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>{vehicleDisplay}</Text>
              </View>
            )}

            {lead.location_address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {lead.location_address}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.customerSection}>
            <View style={styles.customerInfo}>
              <Image
                source={
                  lead.customer_photo_url
                    ? { uri: lead.customer_photo_url }
                    : require('@/assets/profile.png')
                }
                style={styles.avatar}
              />
              <View style={styles.customerDetails}>
                <Text style={[styles.customerName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {lead.customer_name}
                </Text>
                {lead.customer_review_count > 0 ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.primary} />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                      {lead.customer_rating.toFixed(1)} ({lead.customer_review_count} reviews)
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.noReviews, { color: colors.textMuted }]}>No reviews yet</Text>
                )}
              </View>
            </View>

            {lead.has_quoted && lead.quote_amount && (
              <View style={[styles.quotedChip, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <View>
                  <Text style={[styles.quotedLabel, { color: colors.textMuted }]}>Quoted</Text>
                  <Text style={[styles.quoteAmount, { color: colors.accent }]}>
                    ${(lead.quote_amount / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.viewButton, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
              onPress={() => onPressView(lead.job_id)}
            >
              <Ionicons name="eye-outline" size={18} color={colors.textPrimary} />
              <Text style={[styles.viewButtonText, { color: colors.textPrimary }]}>Review</Text>
            </TouchableOpacity>

            {!lead.has_quoted && (
              <TouchableOpacity
                style={[styles.quoteButton, { backgroundColor: colors.accent }]}
                onPress={() => onPressQuote(lead.job_id)}
              >
                <Ionicons name="cash-outline" size={18} color="#fff" />
                <Text style={styles.quoteButtonText}>Send Quote</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  timeAgo: {
    fontSize: 13,
    fontWeight: '500',
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  detailsSection: {
    gap: 6,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoSection: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
  },
  noReviews: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  quotedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quotedLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  quoteAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  quoteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});