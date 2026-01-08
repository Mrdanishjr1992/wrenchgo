import { supabase } from './supabase';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  CreateSupportRequestPayload,
  SupportRequestResponse,
  SupportRequest,
  SupportRequestMetadata,
} from '../types/support';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

function getDeviceMetadata(): Partial<SupportRequestMetadata> {
  return {
    platform: Platform.OS,
    app_version: APP_VERSION,
    device_model: Device.modelName || `${Platform.OS} ${Platform.Version}`,
  };
}

export async function uploadSupportScreenshot(
  uri: string,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('support-screenshots')
      .upload(fileName, blob, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (error) {
      console.error('Screenshot upload error:', error);
      return { url: null, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('support-screenshots')
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Screenshot upload exception:', error);
    return { url: null, error: 'Failed to upload screenshot' };
  }
}

export async function submitSupportRequest(
  payload: CreateSupportRequestPayload
): Promise<SupportRequestResponse> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return {
        success: false,
        error: 'You must be logged in to submit a support request',
      };
    }

    const deviceMetadata = getDeviceMetadata();
    const metadata = {
      ...deviceMetadata,
      ...payload.metadata,
    };

    const { data, error } = await supabase.functions.invoke('support-request', {
      body: {
        category: payload.category,
        message: payload.message,
        job_id: payload.job_id,
        screenshot_url: payload.screenshot_url,
        metadata,
      },
    });

    if (error) {
      console.error('Support request error:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit support request',
      };
    }

    return data as SupportRequestResponse;
  } catch (error) {
    console.error('Support request exception:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

export async function getUserSupportRequests(
  limit: number = 10
): Promise<SupportRequest[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_support_requests', {
      p_limit: limit,
    });

    if (error) {
      console.error('Error fetching support requests:', error);
      return [];
    }

    return (data || []) as SupportRequest[];
  } catch (error) {
    console.error('Exception fetching support requests:', error);
    return [];
  }
}

export async function getSupportRequestById(
  requestId: string
): Promise<SupportRequest | null> {
  try {
    const { data, error } = await supabase
      .from('support_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('Error fetching support request:', error);
      return null;
    }

    return data as SupportRequest;
  } catch (error) {
    console.error('Exception fetching support request:', error);
    return null;
  }
}
