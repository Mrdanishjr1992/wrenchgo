import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type TrustLevel = 'new' | 'building' | 'established' | 'trusted' | 'elite';

export interface TrustScoreData {
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
  reviews_received: number;
  avg_rating_received: number;
  last_calculated_at: string;
}

export interface UseTrustScoreResult {
  score: number;
  label: string;
  level: TrustLevel;
  color: string;
  data: TrustScoreData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  recalculate: (reason?: string) => Promise<void>;
}

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 80) return 'elite';
  if (score >= 60) return 'trusted';
  if (score >= 40) return 'established';
  if (score >= 20) return 'building';
  return 'new';
}

export function getTrustLabel(score: number): string {
  const level = getTrustLevel(score);
  const labels: Record<TrustLevel, string> = {
    new: 'New',
    building: 'Building',
    established: 'Established',
    trusted: 'Trusted',
    elite: 'Elite',
  };
  return labels[level];
}

export function getTrustColor(score: number): string {
  const level = getTrustLevel(score);
  const colors: Record<TrustLevel, string> = {
    new: '#9CA3AF',
    building: '#F59E0B',
    established: '#3B82F6',
    trusted: '#10B981',
    elite: '#8B5CF6',
  };
  return colors[level];
}

export function useTrustScore(userId: string | null | undefined): UseTrustScoreResult {
  const [data, setData] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrustScore = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: trustData, error: fetchError } = await supabase
        .from('trust_scores')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setData(null);
        } else {
          throw fetchError;
        }
      } else {
        setData(trustData as TrustScoreData);
      }
    } catch (err) {
      console.error('Error fetching trust score:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trust score');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const recalculate = useCallback(async (reason: string = 'manual_refresh') => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('recalculate_trust_score', {
        p_user_id: userId,
        p_reason: reason,
        p_job_id: null,
      });

      if (rpcError) throw rpcError;

      await fetchTrustScore();
    } catch (err) {
      console.error('Error recalculating trust score:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate trust score');
      setLoading(false);
    }
  }, [userId, fetchTrustScore]);

  useEffect(() => {
    fetchTrustScore();
  }, [fetchTrustScore]);

  const score = data?.overall_score ?? 50;
  const level = getTrustLevel(score);
  const label = getTrustLabel(score);
  const color = getTrustColor(score);

  return {
    score,
    label,
    level,
    color,
    data,
    loading,
    error,
    refetch: fetchTrustScore,
    recalculate,
  };
}

export async function recalculateTrustScore(
  userId: string,
  reason: string = 'app_triggered',
  jobId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('recalculate_trust_score', {
      p_user_id: userId,
      p_reason: reason,
      p_job_id: jobId || null,
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error recalculating trust score:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to recalculate',
    };
  }
}
