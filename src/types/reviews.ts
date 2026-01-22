export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type BadgeType = 'verified_skill' | 'earned' | 'admin';
export type BadgeSource = 'admin' | 'manual' | 'system';
export type ReviewerRole = 'customer' | 'mechanic';
export type ReportReason = 'spam' | 'inappropriate' | 'fake' | 'harassment' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  created_at: string;
}

export interface MechanicSkill {
  id: string;
  mechanic_id: string;
  skill_id: string;
  level: SkillLevel;
  years_experience: number | null;
  is_verified: boolean;
  verification_method: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  skill?: Skill;
}

export interface Badge {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  badge_type: BadgeType;
  criteria_json: Record<string, any> | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  source: BadgeSource;
  awarded_at: string;
  expires_at: string | null;
  badge?: Badge;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: ReviewerRole;
  reviewee_role: ReviewerRole;
  overall_rating: number;
  performance_rating: number;
  timing_rating: number;
  cost_rating: number;
  comment: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  hidden_by: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  };
  reviewee?: {
    id: string;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  };
}

export interface ReviewReport {
  id: string;
  review_id: string;
  reported_by: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface UserRating {
  user_id: string;
  review_count: number;
  avg_overall_rating: number;
  // Mechanic ratings (from customer reviews)
  avg_performance_rating: number;
  avg_timing_rating: number;
  avg_cost_rating: number;
  // Customer ratings (from mechanic reviews)
  avg_communication_rating: number;
  avg_punctuality_rating: number;
  avg_payment_rating: number;
  last_review_at: string;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

export interface PublicProfile {
  id: string;
  role: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  display_name?: string;
  city?: string;
  bio?: string;
  is_available?: boolean;
  profile_complete?: boolean;
  service_area?: string;
  radius_miles?: number;
  ratings?: UserRating;
  badges?: UserBadge[];
  skills?: MechanicSkill[];
}

export interface CreateReviewPayload {
  job_id: string;
  reviewee_id: string;
  reviewer_role: ReviewerRole;
  reviewee_role: ReviewerRole;
  overall_rating: number;
  performance_rating: number;
  timing_rating: number;
  cost_rating: number;
  comment?: string;
}

export interface CreateSkillPayload {
  skill_id: string;
  level: SkillLevel;
  years_experience?: number;
}

export interface ReportReviewPayload {
  review_id: string;
  reason: ReportReason;
  details?: string;
}
