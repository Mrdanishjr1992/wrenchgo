// Profile Card Types for Quotes Flow
export interface PublicProfileCardRatings {
  overall_avg: number;
  performance_avg: number;
  timing_avg: number;
  cost_avg: number;
  review_count: number;
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
    badge_type: 'achievement' | 'certification' | 'verification' | 'milestone';
  };
}

export interface PublicProfileCardSkill {
  id: string;
  skill: {
    key: string;
    label: string;
    name?: string;  // Fallback for compatibility
    category: string;
  };
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
}

export type ProfileCardVariant = 'mini' | 'full';
export type ProfileCardContext = 'quote_list' | 'quote_detail' | 'quote_compose';
