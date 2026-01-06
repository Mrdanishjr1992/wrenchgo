import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import { usePublicProfileCard } from '@/src/hooks/use-public-profile-card';
import type {
  PublicProfileCard,
  ProfileCardVariant,
} from '@/src/types/profile-card';

interface UserProfileCardProps {
  userId: string;
  variant?: ProfileCardVariant;
  showActions?: boolean;
  onPressViewProfile?: () => void;
  onPressReviews?: () => void;
}

export function UserProfileCard({
  userId,
  variant = 'mini',
  showActions = false,
  onPressViewProfile,
  onPressReviews,
}: UserProfileCardProps) {
  const { profile, loading, error, refetch } = usePublicProfileCard(userId);
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{error || 'Profile not found'}</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryButton}>
          <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (variant === 'mini') {
    return <MiniProfileCard profile={profile} onPress={onPressViewProfile} />;
  }

  return (
    <FullProfileCard
      profile={profile}
      showActions={showActions}
      onPressReviews={onPressReviews}
    />
  );
}

function getTrustColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  return '#9CA3AF';
}

function getTrustLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Trusted';
  if (score >= 40) return 'Established';
  if (score >= 20) return 'Building';
  return 'New';
}

function MiniProfileCard({
  profile,
  onPress,
}: {
  profile: PublicProfileCard;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const hasRatings = profile.ratings.review_count > 0;
  const trustScore = profile.trust_score?.overall_score ?? 50;

  const content = (
    <View style={[styles.miniCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.miniAvatarContainer}>
        <Image
          source={
            profile.avatar_url
              ? { uri: profile.avatar_url }
              : require('../../assets/profile.png')
          }
          style={styles.miniAvatar}
        />
        {trustScore >= 70 && (
          <View style={[styles.trustBadge, { backgroundColor: getTrustColor(trustScore) }]}>
            <Ionicons name="shield-checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.miniInfo}>
        <View style={styles.miniHeader}>
          <Text style={[styles.miniName, { color: colors.textPrimary }]} numberOfLines={1}>
            {profile.display_name}
          </Text>
          {profile.role === 'mechanic' && (
            <View style={[styles.roleBadge, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="construct" size={12} color={colors.accent} />
            </View>
          )}
        </View>

        <View style={styles.miniRating}>
          <Ionicons name="star" size={14} color={hasRatings ? '#FFD700' : colors.textMuted} />
          <Text style={[styles.ratingText, { color: colors.textPrimary }]}>
            {hasRatings ? profile.ratings.overall_avg.toFixed(1) : '0.0'}
          </Text>
          <Text style={[styles.reviewCount, { color: colors.textMuted }]}>
            ({profile.ratings.review_count})
          </Text>
          {profile.trust_score && profile.trust_score.completed_jobs > 0 && (
            <Text style={[styles.jobsCount, { color: colors.textMuted }]}>
              • {profile.trust_score.completed_jobs} jobs
            </Text>
          )}
        </View>

        {profile.badges.length > 0 && (
          <View style={styles.miniBadges}>
            {profile.badges.slice(0, 3).map((badge) => (
              <View key={badge.id} style={[styles.badgeChip, { backgroundColor: colors.bg }]}>
                <Text style={styles.badgeIcon}>{badge.badge.icon}</Text>
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
}: {
  profile: PublicProfileCard;
  showActions?: boolean;
  onPressReviews?: () => void;
}) {
  const { colors } = useTheme();
  const hasRatings = profile.ratings.review_count > 0;
  const hasContent = profile.badges.length > 0 || (profile.role === 'mechanic' && profile.skills.length > 0);
  const trustScore = profile.trust_score?.overall_score ?? 50;
  const verifiedSkills = profile.skills.filter(s => s.is_verified);

  return (
    <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.fullHeader}>
        <View style={styles.avatarSection}>
          <Image
            source={
              profile.avatar_url
                ? { uri: profile.avatar_url }
                : require('../../assets/profile.png')
            }
            style={styles.fullAvatar}
          />
          {trustScore >= 70 && (
            <View style={[styles.trustBadgeLarge, { backgroundColor: getTrustColor(trustScore) }]}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
            </View>
          )}
        </View>
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

      {profile.trust_score && (
        <View style={[styles.trustSection, { backgroundColor: getTrustColor(trustScore) + '15', borderColor: getTrustColor(trustScore) + '40' }]}>
          <View style={styles.trustHeader}>
            <Ionicons name="shield-checkmark" size={18} color={getTrustColor(trustScore)} />
            <Text style={[styles.trustLabel, { color: getTrustColor(trustScore) }]}>
              {getTrustLabel(trustScore)} ({trustScore}/100)
            </Text>
          </View>
          <View style={styles.trustStats}>
            <View style={styles.trustStat}>
              <Text style={[styles.trustStatValue, { color: colors.textPrimary }]}>
                {profile.trust_score.completed_jobs}
              </Text>
              <Text style={[styles.trustStatLabel, { color: colors.textMuted }]}>Jobs</Text>
            </View>
            <View style={styles.trustStat}>
              <Text style={[styles.trustStatValue, { color: colors.textPrimary }]}>
                {profile.ratings.review_count}
              </Text>
              <Text style={[styles.trustStatLabel, { color: colors.textMuted }]}>Reviews</Text>
            </View>
            <View style={styles.trustStat}>
              <Text style={[styles.trustStatValue, { color: colors.textPrimary }]}>
                {profile.badges.length}
              </Text>
              <Text style={[styles.trustStatLabel, { color: colors.textMuted }]}>Badges</Text>
            </View>
          </View>
        </View>
      )}

      {profile.role === 'mechanic' && (
        <View style={styles.ratingsSection}>
          <View style={styles.overallRating}>
            <Ionicons name="star" size={32} color={hasRatings ? '#FFD700' : colors.textMuted} />
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
                <RatingBar label="Performance" value={profile.ratings.performance_avg} icon="speedometer" />
                <RatingBar label="Timing" value={profile.ratings.timing_avg} icon="time" />
                <RatingBar label="Professionalism" value={profile.ratings.professionalism_avg} icon="briefcase" />
              </View>

              {profile.ratings.would_recommend_total > 0 && (
                <View style={[styles.recommendRow, { backgroundColor: '#10b98115', borderColor: '#10b98140' }]}>
                  <Ionicons name="thumbs-up" size={16} color="#10b981" />
                  <Text style={{ color: '#10b981', fontWeight: '600', marginLeft: 6 }}>
                    {Math.round((profile.ratings.would_recommend_count / profile.ratings.would_recommend_total) * 100)}% would recommend
                  </Text>
                </View>
              )}

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

      {profile.role === 'mechanic' && profile.skills.length > 0 && (
        <View style={styles.skillsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Skills {verifiedSkills.length > 0 && `(${verifiedSkills.length} verified)`}
          </Text>
          <View style={styles.skillsGrid}>
            {profile.skills.map((skill) => (
              <View
                key={skill.id}
                style={[
                  styles.skillItem,
                  {
                    backgroundColor: skill.is_verified ? '#10b98115' : colors.bg,
                    borderColor: skill.is_verified ? '#10b98140' : colors.border,
                  },
                ]}
              >
                <Text style={[styles.skillLabel, { color: skill.is_verified ? '#10b981' : colors.textPrimary }]}>
                  {skill.skill.label}
                </Text>
                {skill.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={styles.verifiedText}>{skill.verified_job_count}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function RatingBar({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <View style={styles.ratingBar}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.ratingBarLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.ratingBarValue, { color: colors.textPrimary }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: { marginTop: 8, fontSize: 14 },
  errorText: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontSize: 14, fontWeight: '600' },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  miniAvatarContainer: { position: 'relative' },
  miniAvatar: { width: 48, height: 48, borderRadius: 24 },
  trustBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: { flex: 1, marginLeft: 12 },
  miniHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniName: { fontSize: 16, fontWeight: '700', flex: 1 },
  roleBadge: { padding: 4, borderRadius: 6 },
  miniRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 14, fontWeight: '600' },
  reviewCount: { fontSize: 12 },
  jobsCount: { fontSize: 12 },
  miniBadges: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  badgeChip: { padding: 4, borderRadius: 6 },
  badgeIcon: { fontSize: 14 },
  moreBadges: { fontSize: 12, fontWeight: '600' },
  chevron: { marginLeft: 8 },
  fullCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  fullHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarSection: { position: 'relative' },
  fullAvatar: { width: 72, height: 72, borderRadius: 36 },
  trustBadgeLarge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeaderInfo: { flex: 1, marginLeft: 16 },
  fullName: { fontSize: 20, fontWeight: '800' },
  roleContainer: { marginTop: 4 },
  roleText: { fontSize: 14 },
  memberSince: { fontSize: 12, marginTop: 4 },
  trustSection: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1 },
  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustLabel: { fontSize: 14, fontWeight: '700' },
  trustStats: { flexDirection: 'row', marginTop: 10, justifyContent: 'space-around' },
  trustStat: { alignItems: 'center' },
  trustStatValue: { fontSize: 18, fontWeight: '800' },
  trustStatLabel: { fontSize: 11, marginTop: 2 },
  ratingsSection: { marginTop: 16 },
  overallRating: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overallRatingText: { fontSize: 28, fontWeight: '800' },
  reviewCountText: { fontSize: 14 },
  ratingBreakdown: { marginTop: 12, gap: 6 },
  ratingBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBarLabel: { flex: 1, fontSize: 13 },
  ratingBarValue: { fontSize: 13, fontWeight: '600' },
  recommendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
  reviewsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 10 },
  reviewsButtonText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 24 },
  emptyStateText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  badgesSection: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  badgeItemIcon: { fontSize: 18 },
  badgeItemTitle: { fontSize: 13, fontWeight: '500' },
  skillsSection: { marginTop: 16 },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  skillLabel: { fontSize: 13, fontWeight: '500' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
});
