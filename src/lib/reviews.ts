import { supabase } from './supabase';
import type {
  PublicProfile,
  UserRating,
  UserBadge,
  MechanicSkill,
  Review,
  CreateReviewPayload,
  CreateSkillPayload,
  ReportReviewPayload,
  Skill,
  Badge,
} from '../types/reviews';

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      role,
      full_name,
      display_name,
      phone,
      photo_url,
      city,
      service_area,
      bio,
      radius_miles,
      is_available,
      profile_complete,
      created_at
    `)
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !profile) {
    console.error('Error fetching profile:', error);
    return null;
  }

  const [ratings, badges, skills] = await Promise.all([
    getUserRatings(userId),
    getUserBadges(userId),
    profile.role === 'mechanic' ? getMechanicSkills(userId) : Promise.resolve([]),
  ]);

  return {
    ...profile,
    ratings: ratings || undefined,
    badges,
    skills,
  };
}

export async function getUserRatings(userId: string): Promise<UserRating | null> {
  const { data, error } = await supabase
    .from('user_ratings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching ratings:', error);
    return null;
  }

  return data;
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select(`
      id,
      user_id,
      badge_id,
      source,
      awarded_at,
      expires_at,
      badge:badges (
        id,
        code,
        title,
        description,
        icon,
        badge_type,
        criteria_json,
        created_at
      )
    `)
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('awarded_at', { ascending: false });

  if (error) {
    console.error('Error fetching badges:', error);
    return [];
  }

  if (!data) return [];

  return data.map((item: any) => ({
    id: item.id,
    user_id: item.user_id,
    badge_id: item.badge_id,
    source: item.source,
    awarded_at: item.awarded_at,
    expires_at: item.expires_at,
    badge: Array.isArray(item.badge) ? item.badge[0] : item.badge,
  })) as UserBadge[];
}

export async function getMechanicSkills(mechanicId: string): Promise<MechanicSkill[]> {
  const { data, error } = await supabase
    .from('mechanic_skills')
    .select(`
      id,
      mechanic_id,
      skill_id,
      level,
      years_experience,
      is_verified,
      verification_method,
      verified_at,
      verified_by,
      created_at,
      updated_at,
      skill:skills (
        id,
        name,
        category,
        description,
        created_at
      )
    `)
    .eq('mechanic_id', mechanicId)
    .order('is_verified', { ascending: false })
    .order('level', { ascending: false });

  if (error) {
    console.error('Error fetching mechanic skills:', error);
    return [];
  }

  if (!data) return [];

  return data.map((item: any) => ({
    id: item.id,
    mechanic_id: item.mechanic_id,
    skill_id: item.skill_id,
    level: item.level,
    years_experience: item.years_experience,
    is_verified: item.is_verified,
    verification_method: item.verification_method,
    verified_at: item.verified_at,
    verified_by: item.verified_by,
    created_at: item.created_at,
    updated_at: item.updated_at,
    skill: Array.isArray(item.skill) ? item.skill[0] : item.skill,
  })) as MechanicSkill[];
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

  const query = supabase
    .from('reviews')
    .select(`
      id,
      job_id,
      reviewer_id,
      reviewee_id,
      reviewer_role,
      reviewee_role,
      overall_rating,
      performance_rating,
      timing_rating,
      cost_rating,
      comment,
      is_hidden,
      hidden_reason,
      hidden_at,
      hidden_by,
      created_at,
      updated_at,
      reviewer:profiles!reviews_reviewer_id_fkey (
        id,
        full_name,
        display_name,
        photo_url,
        role
      ),
      reviewee:profiles!reviews_reviewee_id_fkey (
        id,
        full_name,
        display_name,
        photo_url,
        role
      )
    `, { count: 'exact' })
    .eq('reviewee_id', userId)
    .eq('is_hidden', false)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching reviews:', error);
    return { reviews: [], total: 0 };
  }

  if (!data) return { reviews: [], total: 0 };

  const reviews = data.map((item: any) => ({
    id: item.id,
    job_id: item.job_id,
    reviewer_id: item.reviewer_id,
    reviewee_id: item.reviewee_id,
    reviewer_role: item.reviewer_role,
    reviewee_role: item.reviewee_role,
    overall_rating: item.overall_rating,
    performance_rating: item.performance_rating,
    timing_rating: item.timing_rating,
    cost_rating: item.cost_rating,
    comment: item.comment,
    is_hidden: item.is_hidden,
    hidden_reason: item.hidden_reason,
    hidden_at: item.hidden_at,
    hidden_by: item.hidden_by,
    created_at: item.created_at,
    updated_at: item.updated_at,
    reviewer: Array.isArray(item.reviewer) ? item.reviewer[0] : item.reviewer,
    reviewee: Array.isArray(item.reviewee) ? item.reviewee[0] : item.reviewee,
  })) as Review[];

  return {
    reviews,
    total: count || 0,
  };
}

export async function submitReview(payload: CreateReviewPayload): Promise<{ success: boolean; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      ...payload,
      reviewer_id: session.session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting review:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function canUserReviewJob(jobId: string): Promise<{ canReview: boolean; reason?: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return { canReview: false, reason: 'Not authenticated' };
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, status, customer_id, accepted_mechanic_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return { canReview: false, reason: 'Job not found' };
  }

  if (job.status !== 'completed') {
    return { canReview: false, reason: 'Job not completed yet' };
  }

  const userId = session.session.user.id;
  const isParticipant = job.customer_id === userId || job.accepted_mechanic_id === userId;

  if (!isParticipant) {
    return { canReview: false, reason: 'Not a participant in this job' };
  }

  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('job_id', jobId)
    .eq('reviewer_id', userId)
    .single();

  if (existingReview) {
    return { canReview: false, reason: 'Already reviewed this job' };
  }

  return { canReview: true };
}

export async function addMechanicSkill(payload: CreateSkillPayload): Promise<{ success: boolean; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('mechanic_skills')
    .insert({
      mechanic_id: session.session.user.id,
      ...payload,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding skill:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateMechanicSkill(
  skillId: string,
  updates: Partial<Pick<MechanicSkill, 'level' | 'years_experience'>>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('mechanic_skills')
    .update(updates)
    .eq('id', skillId)
    .select()
    .single();

  if (error) {
    console.error('Error updating skill:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteMechanicSkill(skillId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('mechanic_skills')
    .delete()
    .eq('id', skillId);

  if (error) {
    console.error('Error deleting skill:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function reportReview(payload: ReportReviewPayload): Promise<{ success: boolean; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('review_reports')
    .insert({
      ...payload,
      reported_by: session.session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error reporting review:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getAllSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }

  return data || [];
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('badge_type')
    .order('title');

  if (error) {
    console.error('Error fetching badges:', error);
    return [];
  }

  return data || [];
}

export async function searchMechanicsBySkill(
  skillId: string,
  options: {
    verifiedOnly?: boolean;
    minLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    limit?: number;
  } = {}
): Promise<PublicProfile[]> {
  const { verifiedOnly = false, limit = 20 } = options;

  let query = supabase
    .from('mechanic_skills')
    .select(`
      mechanic_id,
      profiles!mechanic_skills_mechanic_id_fkey (
        id,
        role,
        full_name,
        display_name,
        photo_url,
        city,
        service_area,
        is_available
      )
    `)
    .eq('skill_id', skillId);

  if (verifiedOnly) {
    query = query.eq('is_verified', true);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Error searching mechanics:', error);
    return [];
  }

  const mechanicIds = data?.map((item: any) => item.mechanic_id) || [];
  
  const profiles = await Promise.all(
    mechanicIds.map((id: string) => getPublicProfile(id))
  );

  return profiles.filter((p): p is PublicProfile => p !== null);
}
