import { supabase } from './supabase';
import type {
  Review,
  ReviewPrompt,
  SubmitReviewPayload,
  SubmitReviewResponse,
  ReviewStatusResponse,
  TrustScore,
  UserBadge,
  Badge,
  ProfileCardData,
  VerifiedMechanicSkill,
  ReportReason,
} from '../types/trust-system';

// =====================================================
// REVIEW SUBMISSION
// =====================================================

export async function submitReview(payload: SubmitReviewPayload): Promise<SubmitReviewResponse> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_job_id: payload.job_id,
    p_reviewee_id: payload.reviewee_id,
    p_overall_rating: payload.overall_rating,
    p_performance_rating: payload.performance_rating ?? null,
    p_timing_rating: payload.timing_rating ?? null,
    p_cost_rating: payload.cost_rating ?? null,
    p_professionalism_rating: payload.professionalism_rating ?? null,
    p_communication_rating: payload.communication_rating ?? null,
    p_comment: payload.comment ?? null,
    p_would_recommend: payload.would_recommend ?? null,
  });

  if (error) {
    console.error('Error submitting review:', error);
    return { success: false, error: error.message };
  }

  return data as SubmitReviewResponse;
}

export async function getReviewStatus(jobId: string): Promise<ReviewStatusResponse | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase.rpc('get_user_review_status', {
    p_job_id: jobId,
    p_user_id: userData.user.id,
  });

  if (error) {
    console.error('Error getting review status:', error);
    return null;
  }

  return data as ReviewStatusResponse;
}

export async function getPendingReviewPrompts(): Promise<ReviewPrompt[]> {
  const { data, error } = await supabase.rpc('get_pending_review_prompts');

  if (error) {
    console.error('Error getting review prompts:', error);
    return [];
  }

  return (data ?? []) as ReviewPrompt[];
}

export async function reportReview(
  reviewId: string,
  reason: ReportReason,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('report_review', {
    p_review_id: reviewId,
    p_reason: reason,
    p_details: details ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

// =====================================================
// REVIEWS FETCHING
// =====================================================

export async function getReviewsForUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ reviews: Review[]; total: number }> {
  const { limit = 10, offset = 0 } = options;

  const { data, error, count } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey (id, full_name, avatar_url),
      reviewee:profiles!reviews_reviewee_id_fkey (id, full_name, avatar_url)
    `, { count: 'exact' })
    .eq('reviewee_id', userId)
    .eq('visibility', 'visible')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching reviews:', error);
    return { reviews: [], total: 0 };
  }

  return {
    reviews: (data ?? []) as Review[],
    total: count ?? 0,
  };
}

export async function getReviewsForJob(jobId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey (id, full_name, avatar_url),
      reviewee:profiles!reviews_reviewee_id_fkey (id, full_name, avatar_url)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching job reviews:', error);
    return [];
  }

  return (data ?? []) as Review[];
}

// =====================================================
// TRUST SCORES
// =====================================================

export async function getTrustScore(userId: string): Promise<TrustScore | null> {
  const { data, error } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching trust score:', error);
    }
    return null;
  }

  return data as TrustScore;
}

export async function recalculateTrustScore(userId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('recalculate_trust_score', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error recalculating trust score:', error);
    return null;
  }

  return data as number;
}

// =====================================================
// BADGES
// =====================================================

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('is_active', true)
    .order('display_priority', { ascending: true });

  if (error) {
    console.error('Error fetching badges:', error);
    return [];
  }

  return (data ?? []) as Badge[];
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select(`
      *,
      badge:badges (*)
    `)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('awarded_at', { ascending: false });

  if (error) {
    console.error('Error fetching user badges:', error);
    return [];
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    badge: Array.isArray(item.badge) ? item.badge[0] : item.badge,
  })) as UserBadge[];
}

// =====================================================
// PROFILE CARD DATA
// =====================================================

export async function getProfileCardData(userId: string): Promise<ProfileCardData | null> {
  // Get base profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      display_name,
      avatar_url,
      role,
      city,
      state,
      created_at
    `)
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile:', profileError);
    return null;
  }

  // Fetch additional data in parallel
  const [trustScore, badges, mechanicData, reviewSummary] = await Promise.all([
    getTrustScore(userId),
    getUserBadges(userId),
    profile.role === 'mechanic' ? getMechanicProfileData(userId) : Promise.resolve(null),
    getReviewSummary(userId),
  ]);

  return {
    ...profile,
    trust_score: trustScore ?? undefined,
    badges: badges.length > 0 ? badges : undefined,
    ...(mechanicData ?? {}),
    review_summary: reviewSummary ?? undefined,
  } as ProfileCardData;
}

async function getMechanicProfileData(mechanicId: string): Promise<Partial<ProfileCardData> | null> {
  const { data: mechProfile, error } = await supabase
    .from('mechanic_profiles')
    .select('bio, years_experience, is_available, service_radius_km, rating_avg, rating_count, jobs_completed')
    .eq('id', mechanicId)
    .single();

  if (error) {
    console.error('Error fetching mechanic profile:', error);
    return null;
  }

  // Get verified skills
  const { data: skills } = await supabase
    .from('mechanic_skills')
    .select(`
      id,
      mechanic_id,
      skill_key,
      verified_job_count,
      avg_job_rating,
      last_verified_at,
      is_verified,
      skill:skills (key, label, category)
    `)
    .eq('mechanic_id', mechanicId)
    .order('is_verified', { ascending: false })
    .order('verified_job_count', { ascending: false });

  return {
    bio: mechProfile?.bio,
    years_experience: mechProfile?.years_experience,
    is_available: mechProfile?.is_available,
    service_radius_km: mechProfile?.service_radius_km,
    rating_avg: mechProfile?.rating_avg,
    rating_count: mechProfile?.rating_count,
    jobs_completed: mechProfile?.jobs_completed,
    skills: (skills ?? []).map((s: any) => ({
      ...s,
      skill: Array.isArray(s.skill) ? s.skill[0] : s.skill,
    })) as VerifiedMechanicSkill[],
  };
}

async function getReviewSummary(userId: string): Promise<ProfileCardData['review_summary'] | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('overall_rating, would_recommend')
    .eq('reviewee_id', userId)
    .eq('visibility', 'visible')
    .eq('is_hidden', false)
    .is('deleted_at', null);

  if (error || !data || data.length === 0) {
    return null;
  }

  const total = data.length;
  const avgRating = data.reduce((sum, r) => sum + r.overall_rating, 0) / total;
  const recommendCount = data.filter(r => r.would_recommend === true).length;
  const recommendTotal = data.filter(r => r.would_recommend !== null).length;

  return {
    total_reviews: total,
    avg_rating: avgRating,
    five_star_count: data.filter(r => r.overall_rating === 5).length,
    four_star_count: data.filter(r => r.overall_rating === 4).length,
    three_star_count: data.filter(r => r.overall_rating === 3).length,
    two_star_count: data.filter(r => r.overall_rating === 2).length,
    one_star_count: data.filter(r => r.overall_rating === 1).length,
    would_recommend_percent: recommendTotal > 0 ? (recommendCount / recommendTotal) * 100 : null,
  };
}

// =====================================================
// SUBSCRIPTIONS
// =====================================================

export function subscribeToReviewPrompts(
  userId: string,
  callback: (prompts: ReviewPrompt[]) => void
) {
  const channel = supabase
    .channel(`review-prompts-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'review_prompts',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getPendingReviewPrompts().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToUserBadges(
  userId: string,
  callback: (badges: UserBadge[]) => void
) {
  const channel = supabase
    .channel(`user-badges-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_badges',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserBadges(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
