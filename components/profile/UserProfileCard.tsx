import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { PublicProfile } from '@/src/types/reviews';

interface UserProfileCardProps {
  profile: PublicProfile;
  onPress?: () => void;
  compact?: boolean;
}

export function UserProfileCard({ profile, onPress, compact = false }: UserProfileCardProps) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const displayName = profile.display_name || profile.full_name;
  const rating = profile.ratings?.avg_overall_rating || 0;
  const reviewCount = profile.ratings?.review_count || 0;

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={compact ? 14 : 16} color="#FFB800" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Ionicons key={i} name="star-half" size={compact ? 14 : 16} color="#FFB800" />
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={compact ? 14 : 16} color="#FFB800" />
        );
      }
    }
    return stars;
  };

  const CardContent = (
    <View style={[styles.card, { backgroundColor }, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: tintColor }]}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {profile.role === 'mechanic' && profile.ratings && profile.ratings.avg_overall_rating >= 4.8 && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.role, { color: iconColor }]}>
              {profile.role === 'mechanic' ? '🔧 Mechanic' : '👤 Customer'}
            </Text>
          </View>

          {profile.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={iconColor} />
              <Text style={[styles.location, { color: iconColor }]} numberOfLines={1}>
                {profile.city}
              </Text>
            </View>
          )}

          {reviewCount > 0 && (
            <View style={styles.ratingRow}>
              <View style={styles.stars}>{renderStars(rating)}</View>
              <Text style={[styles.ratingText, { color: textColor }]}>
                {rating.toFixed(1)}
              </Text>
              <Text style={[styles.reviewCount, { color: iconColor }]}>
                ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}
        </View>
      </View>

      {!compact && profile.ratings && (
        <View style={styles.subRatings}>
          <SubRating
            icon="speedometer-outline"
            label="Performance"
            value={profile.ratings.avg_performance_rating}
            color={textColor}
            iconColor={iconColor}
          />
          <SubRating
            icon="time-outline"
            label="Timing"
            value={profile.ratings.avg_timing_rating}
            color={textColor}
            iconColor={iconColor}
          />
          <SubRating
            icon="cash-outline"
            label="Cost"
            value={profile.ratings.avg_cost_rating}
            color={textColor}
            iconColor={iconColor}
          />
        </View>
      )}

      {!compact && profile.badges && profile.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {profile.badges.map((userBadge) => (
              <View key={userBadge.id} style={[styles.badge, { borderColor: tintColor }]}>
                <Text style={styles.badgeText}>{userBadge.badge?.title}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {!compact && profile.role === 'mechanic' && profile.skills && profile.skills.length > 0 && (
        <View style={styles.skillsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Skills</Text>
          <View style={styles.skillsGrid}>
            {profile.skills.slice(0, 6).map((mechanicSkill) => (
              <View key={mechanicSkill.id} style={[styles.skillChip, { backgroundColor: `${tintColor}15` }]}>
                <Text style={[styles.skillText, { color: tintColor }]} numberOfLines={1}>
                  {mechanicSkill.skill?.name}
                </Text>
                {mechanicSkill.is_verified && (
                  <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {!compact && profile.bio && (
        <View style={styles.bioSection}>
          <Text style={[styles.bio, { color: iconColor }]} numberOfLines={3}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: '#fff',
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
    borderTopColor: '#E0E0E0',
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
});
