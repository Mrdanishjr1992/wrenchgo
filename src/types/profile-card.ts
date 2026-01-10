// Profile Card Types for Quotes Flow
export interface PublicProfileCardRatings {
  overall_avg: number;
  // Mechanic ratings (from customer reviews)
  performance_avg: number;
  timing_avg: number;
  cost_avg: number;
  professionalism_avg: number;
  // Customer ratings (from mechanic reviews)
  communication_avg: number;
  punctuality_avg: number;
  payment_avg: number;
  review_count: number;
  would_recommend_count: number;
  would_recommend_total: number;
}

export interface PublicProfileCardBadge {
  id: string;
  badge_id: string;
  awarded_at: string;
  badge: {
    code: string;
    title: string;
    description: string;
    icon: string;
    category: 'milestone' | 'quality' | 'reliability' | 'skill' | 'special';
    tier: number;
  };
}

export interface PublicProfileCardSkill {
  id: string;
  skill: {
    key: string;
    label: string;
    name?: string;
    category: string;
  };
  is_verified: boolean;
  verified_job_count: number;
  avg_job_rating: number | null;
}

export interface PublicProfileCardTrustScore {
  overall_score: number;
  rating_score: number;
  completion_score: number;
  reliability_score: number;
  badge_score: number;
  tenure_score: number;
  completed_jobs: number;
  total_jobs: number;
}

export interface PublicProfileCard {
  id: string;
  role: 'customer' | 'mechanic';
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  ratings: PublicProfileCardRatings;
  badges: PublicProfileCardBadge[];
  skills: PublicProfileCardSkill[];
  trust_score: PublicProfileCardTrustScore;
}

export type ProfileCardVariant = 'mini' | 'full';
export type ProfileCardContext = 'quote_list' | 'quote_detail' | 'quote_compose';
