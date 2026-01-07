import { supabase } from './supabase';

export type ReviewPrompt = {
  id: string;
  job_id: string;
  target_user_id: string;
  expires_at: string;
  target_name: string;
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
        target:profiles!review_prompts_target_user_id_fkey(full_name)
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
