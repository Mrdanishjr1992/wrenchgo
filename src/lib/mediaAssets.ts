import { supabase } from './supabase';

interface MediaAsset {
  id: string;
  key: string;
  bucket: string;
  path: string;
  content_type: string;
  duration_seconds?: number;
  size_bytes?: number;
  public_url?: string;
  created_at: string;
  updated_at: string;
}

const mediaCache = new Map<string, string>();
let isInitialized = false;

export async function initializeMediaAssets(): Promise<void> {
  if (isInitialized) return;

  try {
    const { data, error } = await supabase
      .from('media_assets')
      .select('key, public_url');

    if (error) {
      console.error('Failed to load media assets:', error);
      return;
    }

    if (data) {
      data.forEach((asset: { key: string; public_url: string | null }) => {
        if (asset.public_url) {
          mediaCache.set(asset.key, asset.public_url);
        }
      });
      isInitialized = true;
    }
  } catch (error) {
    console.error('Error initializing media assets:', error);
  }
}

export async function getMediaUrl(key: string): Promise<string | null> {
  if (mediaCache.has(key)) {
    return mediaCache.get(key)!;
  }

  try {
    const { data, error } = await supabase
      .from('media_assets')
      .select('public_url')
      .eq('key', key)
      .single();

    if (error) {
      console.error(`Failed to fetch media asset: ${key}`, error);
      return null;
    }

    if (data?.public_url) {
      mediaCache.set(key, data.public_url);
      return data.public_url;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching media URL for ${key}:`, error);
    return null;
  }
}

export function getMediaUrlSync(key: string): string | null {
  return mediaCache.get(key) || null;
}

export const MEDIA_KEYS = {
  LOGO_VIDEO: 'logo_video',
  WRENCHGO_AD_1: 'wrenchgo_ad_1',
  WRENCHGO_AD_2: 'wrenchgo_ad_2',
  WRENCHGO_AD_3: 'wrenchgo_ad_3',
} as const;
