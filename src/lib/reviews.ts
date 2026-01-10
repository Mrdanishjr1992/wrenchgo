import { supabase } from './supabase';

export type ReviewPrompt = {
  id: string;
  job_id: string;
  target_user_id: string;
  expires_at: string;
  target_name: string;
  job_title?: string;
};

export type Review = {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  overall_rating: number;
  professionalism_rating: number | null;
  communication_rating: number | null;
  performance_rating: number | null;
  timing_rating: number | null;
  cost_rating: number | null;
  punctuality_rating: number | null;
  payment_rating: number | null;
  comment: string | null;
  visibility: string;
  created_at: string;
  reviewer_name: string;
  reviewer?: {
    full_name: string;
  };
  media: ReviewMedia[];
};

export type ReviewMedia = {
  id: string;
  media_url: string;
  media_type: string;
  is_before: boolean;
  caption: string | null;
};

export type MechanicRatingStats = {
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
};

export async function getPendingReviewPrompts(userId: string): Promise<ReviewPrompt[]> {
  try {
    const { data, error } = await supabase
      .from('review_prompts')
      .select(
        `
        id,
        job_id,
        target_user_id,
        expires_at,
        target:profiles!review_prompts_target_user_id_fkey(full_name),
        job:jobs(title)
      `
      )
      .eq('user_id', userId)
      .is('completed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((prompt: any) => ({
      id: prompt.id,
      job_id: prompt.job_id,
      target_user_id: prompt.target_user_id,
      expires_at: prompt.expires_at,
      target_name: prompt.target?.full_name || 'User',
      job_title: prompt.job?.title || 'Job',
    }));
  } catch (err) {
    console.error('Error fetching review prompts:', err);
    return [];
  }
}

export async function hasReviewedJob(userId: string, jobId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', userId)
      .eq('job_id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return !!data;
  } catch (err) {
    console.error('Error checking review status:', err);
    return false;
  }
}

export async function getReviewsForMechanic(
  mechanicId: string,
  visibleOnly: boolean = true
): Promise<Review[]> {
  try {
    let query = supabase
      .from('reviews')
      .select(
        `
        id,
        job_id,
        reviewer_id,
        reviewee_id,
        overall_rating,
        performance_rating,
        timing_rating,
        cost_rating,
        comment,
        visibility,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey(full_name),
        media:review_media(id, media_url, media_type, is_before, caption)
      `
      )
      .eq('reviewee_id', mechanicId)
      .order('created_at', { ascending: false });

    if (visibleOnly) {
      query = query.eq('visibility', 'visible');
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((review: any) => ({
      id: review.id,
      job_id: review.job_id,
      reviewer_id: review.reviewer_id,
      reviewee_id: review.reviewee_id,
      overall_rating: review.overall_rating,
      professionalism_rating: review.performance_rating,
      communication_rating: review.timing_rating,
      performance_rating: review.performance_rating,
      timing_rating: review.timing_rating,
      cost_rating: review.cost_rating,
      comment: review.comment,
      visibility: review.visibility,
      created_at: review.created_at,
      reviewer_name: review.reviewer?.full_name || 'Customer',
      reviewer: review.reviewer,
      media: review.media || [],
    }));
  } catch (err) {
    console.error('Error fetching mechanic reviews:', err);
    return [];
  }
}

export async function getMechanicRatingStats(mechanicId: string): Promise<MechanicRatingStats | null> {
  try {
    const { data, error } = await supabase
      .from('mechanic_profiles')
      .select('rating_avg, rating_count, jobs_completed')
      .eq('id', mechanicId)
      .single();

    if (error) throw error;

    return data as MechanicRatingStats;
  } catch (err) {
    console.error('Error fetching mechanic rating stats:', err);
    return null;
  }
}

export async function getReviewPromptForJob(
  userId: string,
  jobId: string
): Promise<ReviewPrompt | null> {
  try {
    const { data, error } = await supabase
      .from('review_prompts')
      .select(
        `
        id,
        job_id,
        target_user_id,
        expires_at,
        target:profiles!review_prompts_target_user_id_fkey(full_name),
        job:jobs(title)
      `
      )
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .is('completed_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      id: data.id,
      job_id: data.job_id,
      target_user_id: data.target_user_id,
      expires_at: data.expires_at,
      target_name: (data as any).target?.full_name || 'User',
      job_title: (data as any).job?.title || 'Job',
    };
  } catch (err) {
    console.error('Error fetching review prompt for job:', err);
    return null;
  }
}

export async function markReviewPromptCompleted(promptId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('review_prompts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', promptId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking review prompt completed:', err);
    return false;
  }
}

export async function getPublicProfile(userId: string): Promise<any | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, display_name, avatar_url, created_at, city')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (profileError) throw profileError;
    if (!profile) return null;

    const { data: reviews } = await supabase
      .from('reviews')
      .select('overall_rating, performance_rating, timing_rating, cost_rating, communication_rating, punctuality_rating, payment_rating')
      .eq('reviewee_id', userId)
      .eq('is_hidden', false)
      .is('deleted_at', null);

    const ratingCount = reviews?.length || 0;
    const ratingAvg = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + r.overall_rating, 0) / ratingCount
      : 0;

    // Calculate role-specific averages
    const avgPerformance = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.performance_rating || 0), 0) / ratingCount
      : 0;
    const avgTiming = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.timing_rating || 0), 0) / ratingCount
      : 0;
    const avgCost = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.cost_rating || 0), 0) / ratingCount
      : 0;
    const avgCommunication = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.communication_rating || 0), 0) / ratingCount
      : 0;
    const avgPunctuality = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.punctuality_rating || 0), 0) / ratingCount
      : 0;
    const avgPayment = ratingCount > 0
      ? reviews!.reduce((sum, r) => sum + (r.payment_rating || 0), 0) / ratingCount
      : 0;

    let serviceArea: string | undefined;
    let radiusMiles: number | undefined;
    let bio: string | undefined;
    let isAvailable: boolean | undefined;

    if (profile.role === 'mechanic') {
      const { data: mechProfile } = await supabase
        .from('mechanic_profiles')
        .select('service_area, radius_miles, bio, is_available')
        .eq('id', userId)
        .single();

      serviceArea = mechProfile?.service_area;
      radiusMiles = mechProfile?.radius_miles;
      bio = mechProfile?.bio;
      isAvailable = mechProfile?.is_available;
    }

    return {
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name || '',
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      city: profile.city,
      phone: null,
      bio,
      is_available: isAvailable,
      service_area: serviceArea,
      radius_miles: radiusMiles,
      ratings: {
        review_count: ratingCount,
        avg_overall_rating: ratingAvg,
        avg_performance_rating: avgPerformance,
        avg_timing_rating: avgTiming,
        avg_cost_rating: avgCost,
        avg_communication_rating: avgCommunication,
        avg_punctuality_rating: avgPunctuality,
        avg_payment_rating: avgPayment,
        last_review_at: '',
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
      },
    };
  } catch (err) {
    console.error('Error fetching public profile:', err);
    return null;
  }
}

export async function getUserReviews(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: 'created_at' | 'overall_rating';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ reviews: Review[]; total: number }> {
  const { limit = 10, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = options;

  try {
    const { count } = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('reviewee_id', userId)
      .eq('is_hidden', false)
      .is('deleted_at', null);

    const { data, error } = await supabase
      .from('reviews')
      .select(
        `
        id,
        job_id,
        reviewer_id,
        reviewee_id,
        overall_rating,
        performance_rating,
        timing_rating,
        cost_rating,
        communication_rating,
        punctuality_rating,
        payment_rating,
        comment,
        is_hidden,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey(full_name)
      `
      )
      .eq('reviewee_id', userId)
      .eq('is_hidden', false)
      .is('deleted_at', null)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const reviews = (data || []).map((review: any) => ({
      id: review.id,
      job_id: review.job_id,
      reviewer_id: review.reviewer_id,
      reviewee_id: review.reviewee_id,
      overall_rating: review.overall_rating,
      professionalism_rating: review.performance_rating,
      communication_rating: review.communication_rating,
      performance_rating: review.performance_rating,
      timing_rating: review.timing_rating,
      cost_rating: review.cost_rating,
      punctuality_rating: review.punctuality_rating,
      payment_rating: review.payment_rating,
      comment: review.comment,
      visibility: review.is_hidden ? 'hidden' : 'visible',
      created_at: review.created_at,
      reviewer_name: review.reviewer?.full_name || 'User',
      reviewer: review.reviewer,
      media: [],
    }));

    return { reviews, total: count || 0 };
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    return { reviews: [], total: 0 };
  }
}

export async function reportReview(params: {
  review_id: string;
  reason: 'spam' | 'inappropriate' | 'fake' | 'other';
  details?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase.from('review_reports').insert({
      review_id: params.review_id,
      reported_by: user.id,
      reason: params.reason,
      details: params.details,
    });

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error reporting review:', err);
    return { success: false, error: err.message || 'Failed to report review' };
  }
}
