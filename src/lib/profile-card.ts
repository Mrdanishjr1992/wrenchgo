import { supabase } from './supabase';
import type { PublicProfileCard } from '../types/profile-card';

// In-memory cache for profile cards
// Key: userId, Value: { data, timestamp }
const profileCardCache = new Map<string, { data: PublicProfileCard; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get public profile card data using RPC
 * Includes in-memory caching to avoid redundant fetches
 */
export async function getPublicProfileCard(
  userId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<PublicProfileCard | null> {
  const { forceRefresh = false } = options;

  // Check cache first
  if (!forceRefresh) {
    const cached = profileCardCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_public_profile_card', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error fetching profile card:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Cache the result
    profileCardCache.set(userId, {
      data: data as PublicProfileCard,
      timestamp: Date.now(),
    });

    return data as PublicProfileCard;
  } catch (err) {
    console.error('Exception fetching profile card:', err);
    return null;
  }
}

/**
 * Batch fetch multiple profile cards
 * Optimized to avoid N+1 queries in quotes list
 */
export async function getPublicProfileCards(
  userIds: string[],
  options: { forceRefresh?: boolean } = {}
): Promise<Map<string, PublicProfileCard>> {
  const { forceRefresh = false } = options;
  const result = new Map<string, PublicProfileCard>();
  const toFetch: string[] = [];

  // Check cache for each user
  for (const userId of userIds) {
    if (!forceRefresh) {
      const cached = profileCardCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        result.set(userId, cached.data);
        continue;
      }
    }
    toFetch.push(userId);
  }

  // Fetch uncached profiles in parallel
  if (toFetch.length > 0) {
    const promises = toFetch.map((userId) =>
      getPublicProfileCard(userId, { forceRefresh: true })
    );

    const profiles = await Promise.all(promises);

    profiles.forEach((profile, index) => {
      if (profile) {
        result.set(toFetch[index], profile);
      }
    });
  }

  return result;
}

/**
 * Clear cache for a specific user or all users
 */
export function clearProfileCardCache(userId?: string): void {
  if (userId) {
    profileCardCache.delete(userId);
  } else {
    profileCardCache.clear();
  }
}

/**
 * Preload profile cards for better UX
 */
export function preloadProfileCards(userIds: string[]): void {
  // Fire and forget - don't await
  getPublicProfileCards(userIds).catch((err) => {
    console.error('Error preloading profile cards:', err);
  });
}
