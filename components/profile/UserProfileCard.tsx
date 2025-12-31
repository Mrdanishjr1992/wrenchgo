import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import type { PublicProfile } from '@/src/types/reviews';

interface UserProfileCardProps {
  profile: PublicProfile;
  onPress?: () => void;
  compact?: boolean;
}

export function UserProfileCard({ profile, onPress, compact = false }: UserProfileCardProps) {
  const { colors } = useTheme();

  const displayName = profile.display_name || profile.full_name;
  const reviewCount = profile.ratings?.review_count || 0;
  const rating = reviewCount > 0 ? (profile.ratings?.avg_overall_rating || 0) : 0;

  const renderStars = (rating: number) => {
    const stars = [];
    const starsFilled = Math.round(rating);

    for (let i = 0; i < 5; i++) {
      if (i < starsFilled) {
        stars.push(
          <Ionicons key={i} name="star" size={compact ? 14 : 16} color={colors.primary} />
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={compact ? 14 : 16} color={colors.textMuted} />
        );
      }
    }
    return stars;
  };

  const CardContent = (
    <View style={[styles.card, {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.textPrimary,
    }, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {profile.role === 'mechanic' && profile.ratings && profile.ratings.avg_overall_rating >= 4.8 && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.role, { color: colors.textSecondary }]}>
              {profile.role === 'mechanic' ? '🔧 Mechanic' : '👤 Customer'}
            </Text>
          </View>

          {profile.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                {profile.city}
              </Text>
            </View>
          )}

          <View style={styles.ratingRow}>
            <View style={styles.stars}>{renderStars(rating)}</View>
            <Text style={[styles.ratingText, { color: colors.textPrimary }]}>
              {rating.toFixed(1)}
            </Text>
            <Text style={[styles.reviewCount, { color: colors.textSecondary }]}>
              {reviewCount > 0
                ? `(${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`
                : '(No ratings yet)'
              }
            </Text>
          </View>
        </View>
      </View>

      {!compact && profile.role === 'mechanic' && (
        <View style={[styles.subRatings, { borderTopColor: colors.border }]}>
          <SubRating
            icon="speedometer-outline"
            label="Performance"
            value={profile.ratings?.avg_performance_rating || 0}
            color={colors.textPrimary}
            iconColor={colors.textSecondary}
          />
          <SubRating
            icon="time-outline"
            label="Timing"
            value={profile.ratings?.avg_timing_rating || 0}
            color={colors.textPrimary}
            iconColor={colors.textSecondary}
          />
          <SubRating
            icon="cash-outline"
            label="Cost"
            value={profile.ratings?.avg_cost_rating || 0}
            color={colors.textPrimary}
            iconColor={colors.textSecondary}
          />
        </View>
      )}

      {!compact && profile.role === 'mechanic' && (
        <View style={styles.skillsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Skills</Text>
          {profile.skills && profile.skills.length > 0 ? (
            <View style={styles.skillsGrid}>
              {profile.skills.slice(0, 6).map((mechanicSkill) => (
                <View key={mechanicSkill.id} style={[styles.skillChip, { backgroundColor: `${colors.primary}15` }]}>
                  <Text style={[styles.skillText, { color: colors.primary }]} numberOfLines={1}>
                    {mechanicSkill.skill?.name}
                  </Text>
                  {mechanicSkill.is_verified && (
                    <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyStatePlaceholder, { backgroundColor: colors.textMuted + '10', borderColor: colors.border }]}>
                <Ionicons name="construct-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  No verified skills yet
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {!compact && profile.badges && profile.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {profile.badges.map((userBadge) => (
              <View key={userBadge.id} style={[styles.badge, { borderColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{userBadge.badge?.title}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {!compact && profile.bio && (
        <View style={styles.bioSection}>
          <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={3}>
            {profile.bio}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
}

interface SubRatingProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  iconColor: string;
}

function SubRating({ icon, label, value, color, iconColor }: SubRatingProps) {
  return (
    <View style={styles.subRating}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={[styles.subRatingLabel, { color: iconColor }]}>{label}</Text>
      <Text style={[styles.subRatingValue, { color }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompact: {
    padding: 12,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 10,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
    flex: 1,
  },
  role: {
    fontSize: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  location: {
    fontSize: 14,
    marginLeft: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 14,
  },
  subRatings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  subRating: {
    alignItems: 'center',
  },
  subRatingLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  subRatingValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  badgesSection: {
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  skillsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bioSection: {
    marginTop: 12,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateContainer: {
    marginTop: 4,
  },
  emptyStatePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
