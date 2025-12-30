import { useState, useEffect, useCallback } from 'react';
import { getPublicProfileCard, clearProfileCardCache } from '@/src/lib/profile-card';
import type { PublicProfileCard } from '@/src/types/profile-card';

interface UsePublicProfileCardResult {
  profile: PublicProfileCard | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * React hook to fetch and cache public profile card data
 * Automatically handles loading, error states, and caching
 */
export function usePublicProfileCard(userId: string | undefined): UsePublicProfileCardResult {
  const [profile, setProfile] = useState<PublicProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (forceRefresh = false) => {
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getPublicProfileCard(userId, { forceRefresh });
        if (data) {
          setProfile(data);
        } else {
          setError('Profile not found');
        }
      } catch (err) {
        console.error('Error in usePublicProfileCard:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const refetch = useCallback(async () => {
    if (userId) {
      clearProfileCardCache(userId);
      await fetchProfile(true);
    }
  }, [userId, fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch };
}

/**
 * Hook to fetch multiple profile cards at once
 * Useful for quotes list where we need multiple mechanic profiles
 */
export function usePublicProfileCards(userIds: string[]): {
  profiles: Map<string, PublicProfileCard>;
  loading: boolean;
  error: string | null;
} {
  const [profiles, setProfiles] = useState<Map<string, PublicProfileCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userIds.length === 0) {
      setProfiles(new Map());
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = userIds.map((id) => getPublicProfileCard(id));
        const results = await Promise.all(promises);

        if (mounted) {
          const profilesMap = new Map<string, PublicProfileCard>();
          results.forEach((profile, index) => {
            if (profile) {
              profilesMap.set(userIds[index], profile);
            }
          });
          setProfiles(profilesMap);
        }
      } catch (err) {
        console.error('Error fetching multiple profiles:', err);
        if (mounted) {
          setError('Failed to load profiles');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProfiles();

    return () => {
      mounted = false;
    };
  }, [userIds.join(',')]);

  return { profiles, loading, error };
}
