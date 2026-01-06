import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import { usePublicProfileCard } from '@/src/hooks/use-public-profile-card';
import type {
  PublicProfileCard,
  ProfileCardVariant,
  ProfileCardContext,
} from '@/src/types/profile-card';

interface UserProfileCardProps {
  userId: string;
  variant?: ProfileCardVariant;
  context?: ProfileCardContext;
  showActions?: boolean;
  onPressViewProfile?: () => void;
  onPressReviews?: () => void;
}

export function UserProfileCard({
  userId,
  variant = 'mini',
  context = 'quote_list',
  showActions = false,
  onPressViewProfile,
  onPressReviews,
}: UserProfileCardProps) {
  const { profile, loading, error, refetch } = usePublicProfileCard(userId);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: insets.top, marginBottom: insets.bottom, marginLeft: insets.left, marginRight: insets.right }, variant === 'mini' && styles.miniCard]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: insets.top, marginBottom: insets.bottom, marginLeft: insets.left, marginRight: insets.right }, variant === 'mini' && styles.miniCard]}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{error || 'Profile not found'}</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryButton}>
          <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (variant === 'mini') {
    return <MiniProfileCard profile={profile} onPress={onPressViewProfile} insets={insets} />;
  }

  return (
    <FullProfileCard
      profile={profile}
      showActions={showActions}
      onPressReviews={onPressReviews}
      insets={insets}
    />
  );
}

function MiniProfileCard({
  profile,
  onPress,
  insets,
}: {
  profile: PublicProfileCard;
  onPress?: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  const { colors } = useTheme();

  const hasRatings = profile.ratings.review_count > 0;

  const content = (
    <View style={[styles.miniCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: insets.top, marginBottom: insets.bottom, marginLeft: insets.left, marginRight: insets.right }]}>
      <Image
        source={
          profile.avatar_url
            ? { uri: profile.avatar_url }
            : require('../../assets/profile.png')
        }
        style={styles.miniAvatar}
      />
      <View style={styles.miniInfo}>
        <View style={styles.miniHeader}>
          <Text style={[styles.miniName, { color: colors.textPrimary }]} numberOfLines={1}>
            {profile.display_name}
          </Text>
          {profile.role === 'mechanic' && (
            <View style={[styles.roleBadge, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="construct" size={12} color={colors.accent} />
            </View>
          )}
        </View>

        <View style={styles.miniRating}>
          <Ionicons name="star" size={14} color={hasRatings ? colors.primary : colors.textMuted} />
          <Text style={[styles.ratingText, { color: colors.textPrimary }]}>
            {hasRatings ? profile.ratings.overall_avg.toFixed(1) : '0.0'}
          </Text>
          <Text style={[styles.reviewCount, { color: colors.textMuted }]}>
            {hasRatings ? `(${profile.ratings.review_count})` : '(No ratings yet)'}
          </Text>
        </View>

        {profile.badges.length > 0 && (
          <View style={styles.miniBadges}>
            {profile.badges.slice(0, 3).map((badge) => (
              <View key={badge.id} style={[styles.badgeChip, { borderColor: colors.border }]}>
                <Text style={[styles.badgeIcon, { color: colors.accent }]}>{badge.badge.icon}</Text>
              </View>
            ))}
            {profile.badges.length > 3 && (
              <Text style={[styles.moreBadges, { color: colors.textMuted }]}>
                +{profile.badges.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>

      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={styles.chevron} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function FullProfileCard({
  profile,
  showActions,
  onPressReviews,
  insets,
}: {
  profile: PublicProfileCard;
  showActions?: boolean;
  onPressReviews?: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  const { colors } = useTheme();

  const hasRatings = profile.ratings.review_count > 0;
  const hasContent = profile.badges.length > 0 || (profile.role === 'mechanic' && profile.skills.length > 0);

  return (
    <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: insets.top, marginBottom: insets.bottom, marginLeft: insets.left, marginRight: insets.right }]}>
      <View style={styles.fullHeader}>
        <Image
          source={
            profile.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/profile.png')
          }
          style={styles.fullAvatar}
        />
        <View style={styles.fullHeaderInfo}>
          <Text style={[styles.fullName, { color: colors.textPrimary }]}>{profile.display_name}</Text>
          <View style={styles.roleContainer}>
            <Text style={[styles.roleText, { color: colors.textMuted }]}>
              {profile.role === 'mechanic' ? 'Mechanic' : 'Customer'}
            </Text>
          </View>
          <Text style={[styles.memberSince, { color: colors.textMuted }]}>
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {profile.role === 'mechanic' && (
        <View style={styles.ratingsSection}>
          <View style={styles.overallRating}>
            <Ionicons name="star" size={32} color={hasRatings ? colors.primary : colors.textMuted} />
            <Text style={[styles.overallRatingText, { color: colors.textPrimary }]}>
              {hasRatings ? profile.ratings.overall_avg.toFixed(1) : '0.0'}
            </Text>
            <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>
              {hasRatings
                ? `${profile.ratings.review_count} ${profile.ratings.review_count === 1 ? 'review' : 'reviews'}`
                : 'No ratings yet'
              }
            </Text>
          </View>

          {hasRatings && (
            <>
              <View style={styles.ratingBreakdown}>
                <RatingBar
                  label="Performance"
                  value={profile.ratings.performance_avg}
                  icon="speedometer"
                />
                <RatingBar label="Timing" value={profile.ratings.timing_avg} icon="time" />
                <RatingBar label="Cost" value={profile.ratings.cost_avg} icon="cash" />
              </View>

              {showActions && onPressReviews && profile.ratings.review_count > 0 && (
                <TouchableOpacity onPress={onPressReviews} style={styles.reviewsButton}>
                  <Text style={[styles.reviewsButtonText, { color: colors.accent }]}>View All Reviews</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {!hasContent && profile.role === 'customer' && (
        <View style={styles.emptyState}>
          <Ionicons name="information-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
            This customer is new to the platform
          </Text>
        </View>
      )}

      {profile.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Badges</Text>
          <View style={styles.badgesGrid}>
            {profile.badges.map((badge) => (
              <View key={badge.id} style={[styles.badgeItem, { borderColor: colors.border }]}>
                <Text style={styles.badgeItemIcon}>{badge.badge.icon}</Text>
                <Text style={[styles.badgeItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {badge.badge.title}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {profile.role === 'mechanic' && (
        <View style={styles.skillsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Skills & Expertise</Text>
          {profile.skills.length > 0 ? (
            <View style={styles.skillsList}>
              {profile.skills.map((skill) => (
                <View key={skill.id} style={[styles.skillItem, { borderColor: colors.border }]}>
                  <View style={styles.skillHeader}>
                    <Text style={[styles.skillName, { color: colors.textPrimary }]}>{skill.skill?.label || skill.skill?.name || 'Unknown'}</Text>
                  </View>
                  {skill.skill?.category && (
                    <Text style={[styles.experienceText, { color: colors.textMuted }]}>
                      {skill.skill.category}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptySkillsState}>
              <Ionicons name="construct-outline" size={24} color={colors.textMuted} />
              <Text style={[styles.emptySkillsText, { color: colors.textSecondary }]}>
                No verified skills yet
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function RatingBar({ label, value, icon }: { label: string; value: number; icon: any }) {
  const { colors } = useTheme();

  return (
    <View style={styles.ratingBarContainer}>
      <View style={styles.ratingBarLabel}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={[styles.ratingBarText, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <View style={styles.ratingBarValue}>
        <View style={[styles.ratingBarTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.ratingBarFill,
              { backgroundColor: colors.accent, width: `${(value / 5) * 100}%` },
            ]}
          />
        </View>
        <Text style={[styles.ratingBarNumber, { color: colors.textPrimary }]}>{value.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'expert':
      return '#8B5CF6';
    case 'advanced':
      return '#3B82F6';
    case 'intermediate':
      return '#10B981';
    case 'beginner':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  miniAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  miniInfo: {
    flex: 1,
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  roleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  miniLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  miniBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  badgeIcon: {
    fontSize: 12,
  },
  moreBadges: {
    fontSize: 11,
    marginLeft: 4,
  },
  chevron: {
    marginLeft: 8,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fullCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  fullHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  fullAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  fullHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fullName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    marginRight: 8,
  },
  memberSince: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  availableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  availableText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityText: {
    fontSize: 14,
    marginLeft: 4,
  },
  bioSection: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ratingsSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallRatingText: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 8,
  },
  reviewCountText: {
    fontSize: 14,
    marginLeft: 8,
  },
  ratingBreakdown: {
    marginBottom: 12,
  },
  ratingBarContainer: {
    marginBottom: 12,
  },
  ratingBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingBarText: {
    fontSize: 13,
    marginLeft: 6,
  },
  ratingBarValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  ratingBarNumber: {
    fontSize: 13,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  reviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  reviewsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  badgesSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeItemIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  badgeItemTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  skillsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  skillsList: {
    gap: 12,
  },
  skillItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skillName: {
    fontSize: 15,
    fontWeight: '600',
  },
  skillMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  levelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  experienceText: {
    fontSize: 12,
  },
  emptySkillsState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptySkillsText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
