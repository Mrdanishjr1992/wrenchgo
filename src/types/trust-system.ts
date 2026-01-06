// Trust System Types
// Post-completion trust system with blind reviews, badges, skill verification, and trust scores

// =====================================================
// ENUMS
// =====================================================

export type BadgeCategory = 'milestone' | 'quality' | 'reliability' | 'skill' | 'special';
export type ReviewVisibility = 'hidden' | 'visible' | 'moderated';
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type ReportReason = 'fake_review' | 'harassment' | 'spam' | 'inappropriate' | 'conflict_of_interest' | 'other';

// =====================================================
// BADGE TYPES
// =====================================================

export interface Badge {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: BadgeCategory;
  tier: number; // 1=bronze, 2=silver, 3=gold
  criteria_type: string;
  criteria_threshold: number;
  criteria_window_days: number | null;
  is_active: boolean;
  display_priority: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  awarded_reason: string | null;
  source: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  job_id: string | null;
  badge?: Badge;
}

export interface BadgeHistory {
  id: string;
  user_id: string;
  badge_id: string;
  action: string;
  reason: string | null;
  triggered_by: string | null;
  job_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// =====================================================
// REVIEW TYPES
// =====================================================

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: 'customer' | 'mechanic';
  overall_rating: number;
  performance_rating: number | null;
  timing_rating: number | null;
  cost_rating: number | null;
  professionalism_rating: number | null;
  communication_rating: number | null;
  comment: string | null;
  would_recommend: boolean | null;
  is_hidden: boolean;
  visibility: ReviewVisibility;
  made_visible_at: string | null;
  visibility_reason: string | null;
  blind_deadline: string | null;
  moderation_status: ModerationStatus;
  moderated_at: string | null;
  moderated_by: string | null;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined data
  reviewer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  reviewee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  media?: ReviewMedia[];
}

export interface ReviewMedia {
  id: string;
  review_id: string;
  url: string;
  thumbnail_url: string | null;
  media_type: string;
  caption: string | null;
  sort_order: number;
  is_before: boolean;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface ReviewReport {
  id: string;
  review_id: string;
  reported_by: string;
  reason: ReportReason;
  details: string | null;
  status: ModerationStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface ReviewPrompt {
  job_id: string;
  job_title: string;
  target_user_id: string;
  target_user_name: string | null;
  target_user_avatar: string | null;
  user_role: 'customer' | 'mechanic';
  prompted_at: string;
  expires_at: string;
}

// =====================================================
// SKILL VERIFICATION TYPES
// =====================================================

export interface SkillVerification {
  id: string;
  mechanic_id: string;
  skill_key: string;
  job_id: string;
  customer_rating: number | null;
  verification_weight: number;
  verified_at: string;
}

export interface VerifiedMechanicSkill {
  id: string;
  mechanic_id: string;
  skill_key: string;
  verified_job_count: number;
  avg_job_rating: number | null;
  last_verified_at: string | null;
  is_verified: boolean;
  skill?: {
    key: string;
    label: string;
    category: string | null;
  };
}

// =====================================================
// TRUST SCORE TYPES
// =====================================================

export interface TrustScore {
  id: string;
  user_id: string;
  overall_score: number;
  rating_score: number;
  completion_score: number;
  reliability_score: number;
  badge_score: number;
  tenure_score: number;
  total_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  disputed_jobs: number;
  no_show_count: number;
  reviews_given: number;
  reviews_received: number;
  avg_rating_given: number | null;
  avg_rating_received: number | null;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface TrustScoreHistory {
  id: string;
  user_id: string;
  overall_score: number;
  rating_score: number | null;
  completion_score: number | null;
  reliability_score: number | null;
  badge_score: number | null;
  tenure_score: number | null;
  snapshot_reason: string | null;
  job_id: string | null;
  created_at: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface SubmitReviewPayload {
  job_id: string;
  reviewee_id: string;
  overall_rating: number;
  performance_rating?: number;
  timing_rating?: number;
  cost_rating?: number;
  professionalism_rating?: number;
  communication_rating?: number;
  comment?: string;
  would_recommend?: boolean;
}

export interface SubmitReviewResponse {
  success: boolean;
  error?: string;
  review_id?: string;
  is_visible?: boolean;
}

export interface ReviewStatusResponse {
  job_status: string;
  can_review: boolean;
  has_reviewed: boolean;
  my_review: {
    id: string;
    overall_rating: number;
    comment: string | null;
    visibility: ReviewVisibility;
    created_at: string;
  } | null;
  other_has_reviewed: boolean;
  other_review_visible: boolean;
  other_review: {
    id: string;
    overall_rating: number;
    comment: string | null;
    created_at: string;
  } | null;
}

export interface BadgeAwardResponse {
  awarded: Array<{
    badge_code: string;
    badge_title: string;
  }>;
}

// =====================================================
// PROFILE CARD TYPES (updated for trust system)
// =====================================================

export interface ProfileCardData {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: 'customer' | 'mechanic';
  city: string | null;
  state: string | null;
  created_at: string;
  // Trust data
  trust_score?: TrustScore;
  badges?: UserBadge[];
  // Mechanic-specific
  bio?: string | null;
  years_experience?: number | null;
  is_available?: boolean;
  service_radius_km?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
  jobs_completed?: number;
  skills?: VerifiedMechanicSkill[];
  // Review summary
  review_summary?: {
    total_reviews: number;
    avg_rating: number;
    five_star_count: number;
    four_star_count: number;
    three_star_count: number;
    two_star_count: number;
    one_star_count: number;
    would_recommend_percent: number | null;
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getTrustLevel(score: number): 'new' | 'building' | 'established' | 'trusted' | 'excellent' {
  if (score < 20) return 'new';
  if (score < 40) return 'building';
  if (score < 60) return 'established';
  if (score < 80) return 'trusted';
  return 'excellent';
}

export function getTrustLevelLabel(score: number): string {
  const level = getTrustLevel(score);
  const labels: Record<string, string> = {
    new: 'New Member',
    building: 'Building Trust',
    established: 'Established',
    trusted: 'Trusted',
    excellent: 'Excellent',
  };
  return labels[level];
}

export function getTrustLevelColor(score: number): string {
  const level = getTrustLevel(score);
  const colors: Record<string, string> = {
    new: '#9CA3AF',
    building: '#F59E0B',
    established: '#3B82F6',
    trusted: '#10B981',
    excellent: '#8B5CF6',
  };
  return colors[level];
}

export function getBadgeTierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: 'Bronze',
    2: 'Silver',
    3: 'Gold',
  };
  return labels[tier] || 'Standard';
}

export function getBadgeTierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: '#CD7F32',
    2: '#C0C0C0',
    3: '#FFD700',
  };
  return colors[tier] || '#9CA3AF';
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function getStarArray(rating: number): ('full' | 'half' | 'empty')[] {
  const stars: ('full' | 'half' | 'empty')[] = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push('full');
    } else if (rating >= i - 0.5) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }
  return stars;
}
