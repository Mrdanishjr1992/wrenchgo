import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getPendingReviewJobForUser } from '../lib/trust-system';
import type { PendingReviewJob } from '../types/trust-system';

interface MandatoryReviewContextType {
  pendingReview: PendingReviewJob | null;
  isChecking: boolean;
  checkForPendingReview: () => Promise<void>;
  clearPendingReview: () => void;
}

const MandatoryReviewContext = createContext<MandatoryReviewContextType>({
  pendingReview: null,
  isChecking: false,
  checkForPendingReview: async () => {},
  clearPendingReview: () => {},
});

export function useMandatoryReview() {
  return useContext(MandatoryReviewContext);
}

interface MandatoryReviewProviderProps {
  children: React.ReactNode;
}

export function MandatoryReviewProvider({ children }: MandatoryReviewProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  
  const [pendingReview, setPendingReview] = useState<PendingReviewJob | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const lastCheckRef = useRef<number>(0);
  const isNavigatingRef = useRef(false);

  const isOnReviewScreen = pathname?.includes('/(review)/job/') || segments[0] === '(review)';
  const isOnAuthScreen = segments[0] === '(auth)' || pathname === '/' || pathname === '/index';

  const checkForPendingReview = useCallback(async () => {
    if (isChecking || isNavigatingRef.current) return;
    
    const now = Date.now();
    if (now - lastCheckRef.current < 5000) return;
    lastCheckRef.current = now;

    setIsChecking(true);
    try {
      const pending = await getPendingReviewJobForUser();
      setPendingReview(pending);
    } catch (err) {
      console.error('Error checking pending review:', err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  const clearPendingReview = useCallback(() => {
    setPendingReview(null);
    lastCheckRef.current = 0;
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setTimeout(() => checkForPendingReview(), 1000);
      } else {
        setUserId(null);
        setPendingReview(null);
      }
    });

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        checkForPendingReview();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && userId) {
        checkForPendingReview();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId, checkForPendingReview]);

  useEffect(() => {
    if (userId) {
      const channel = supabase
        .channel('job-status-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `status=eq.completed`,
          },
          () => {
            setTimeout(() => checkForPendingReview(), 500);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, checkForPendingReview]);

  useEffect(() => {
    if (!pendingReview || isOnReviewScreen || isOnAuthScreen || isNavigatingRef.current) {
      return;
    }

    isNavigatingRef.current = true;
    
    const timer = setTimeout(() => {
      router.replace(`/(review)/job/${pendingReview.job_id}`);
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    }, 100);

    return () => clearTimeout(timer);
  }, [pendingReview, isOnReviewScreen, isOnAuthScreen, router]);

  useEffect(() => {
    if (!isOnReviewScreen && userId && !isOnAuthScreen) {
      checkForPendingReview();
    }
  }, [pathname, userId, isOnReviewScreen, isOnAuthScreen]);

  return (
    <MandatoryReviewContext.Provider
      value={{
        pendingReview,
        isChecking,
        checkForPendingReview,
        clearPendingReview,
      }}
    >
      {children}
    </MandatoryReviewContext.Provider>
  );
}