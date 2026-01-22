import { useCallback, useEffect, useState, useRef } from 'react';
import * as StoreReview from 'expo-store-review';
import { Platform, Linking } from 'react-native';
import { supabase } from '@/src/lib/supabase';

const APP_STORE_ID = ''; // TODO: Add your App Store ID
const PLAY_STORE_ID = 'com.wrenchgo.app'; // TODO: Confirm package name

export type RatingPromptState = {
  eligible: boolean;
  reason: string;
  promptNumber: number;
  daysSinceLastPrompt: number;
};

export type RatingPromptHook = {
  promptState: RatingPromptState | null;
  loading: boolean;
  showPrompt: boolean;
  showConfirmation: boolean;
  triggerPrompt: () => void;
  dismissPrompt: () => void;
  handleRateApp: () => Promise<void>;
  handleSnooze: () => Promise<void>;
  handleConfirmRated: () => Promise<void>;
  handleConfirmNotYet: () => Promise<void>;
  checkEligibility: () => Promise<void>;
};

export function useRatingPrompt(): RatingPromptHook {
  const [userId, setUserId] = useState<string | null>(null);
  const [promptState, setPromptState] = useState<RatingPromptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  const checkEligibility = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_rating_prompt_eligibility', {
        p_user_id: userId,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0];
        setPromptState({
          eligible: row.eligible,
          reason: row.reason,
          promptNumber: row.prompt_number,
          daysSinceLastPrompt: row.days_since_last_prompt,
        });
      }
    } catch (err) {
      console.error('Error checking rating eligibility:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      checkEligibility();
    }
  }, [userId, checkEligibility]);

  useEffect(() => {
    if (!loading && promptState?.eligible && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      setShowPrompt(true);
    }
  }, [loading, promptState?.eligible]);

  const triggerPrompt = useCallback(() => {
    if (promptState?.eligible) {
      setShowPrompt(true);
    }
  }, [promptState?.eligible]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const handleRateApp = useCallback(async () => {
    if (!userId) return;

    try {
      await supabase.rpc('record_rating_prompt', { p_user_id: userId });
    } catch (err) {
      console.error('Error recording prompt:', err);
    }

    setShowPrompt(false);

    const canUseNative = await StoreReview.isAvailableAsync();

    if (canUseNative) {
      try {
        await StoreReview.requestReview();
      } catch (err) {
        console.error('StoreReview error:', err);
      }
    } else {
      const storeUrl = Platform.select({
        ios: `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
        android: `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`,
        default: '',
      });

      if (storeUrl) {
        try {
          await Linking.openURL(storeUrl);
        } catch (err) {
          console.error('Failed to open store:', err);
        }
      }
    }

    setTimeout(() => {
      setShowConfirmation(true);
    }, 1500);
  }, [userId]);

  const handleSnooze = useCallback(async () => {
    if (!userId) return;

    try {
      await supabase.rpc('snooze_rating_prompt', { p_user_id: userId, p_days: 14 });
      setShowPrompt(false);
      await checkEligibility();
    } catch (err) {
      console.error('Error snoozing prompt:', err);
    }
  }, [userId, checkEligibility]);

  const handleConfirmRated = useCallback(async () => {
    if (!userId) return;

    try {
      await supabase.rpc('confirm_app_rated', { p_user_id: userId });
      setShowConfirmation(false);
      setPromptState((prev) => prev ? { ...prev, eligible: false, reason: 'already_rated' } : null);
    } catch (err) {
      console.error('Error confirming rating:', err);
    }
  }, [userId]);

  const handleConfirmNotYet = useCallback(async () => {
    if (!userId) return;

    try {
      await supabase.rpc('snooze_rating_prompt', { p_user_id: userId, p_days: 7 });
      setShowConfirmation(false);
      await checkEligibility();
    } catch (err) {
      console.error('Error snoozing after not rated:', err);
    }
  }, [userId, checkEligibility]);

  return {
    promptState,
    loading,
    showPrompt,
    showConfirmation,
    triggerPrompt,
    dismissPrompt,
    handleRateApp,
    handleSnooze,
    handleConfirmRated,
    handleConfirmNotYet,
    checkEligibility,
  };
}
