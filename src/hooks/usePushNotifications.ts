import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  registerForPushNotificationsAsync,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
} from '../lib/push-notifications';
import { supabase } from '../lib/supabase';

export function usePushNotifications() {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        const token = await registerForPushNotificationsAsync();
        if (token && mounted) {
          setExpoPushToken(token);
          await savePushToken(user.id, token);
        }
      } catch (error) {
      }
    };

    setup();

    try {
      notificationListener.current = addNotificationReceivedListener((notification) => {
      });

      responseListener.current = addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        if (data?.entityType && data?.entityId) {
          if (data.entityType === 'job') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) {
                supabase
                  .from('profiles')
                  .select('role')
                  .eq('id', user.id)
                  .single()
                  .then(({ data: profile }) => {
                    if (profile?.role === 'mechanic') {
                      router.push(`/(mechanic)/job-details/${data.entityId}` as any);
                    } else {
                      router.push(`/(customer)/job/${data.entityId}` as any);
                    }
                  });
              }
            });
          } else if (data.entityType === 'message') {
            router.push(`/messages/${data.entityId}` as any);
          }
        }
      });
    } catch (error) {
    }

    return () => {
      mounted = false;
      removeNotificationSubscription(notificationListener.current);
      removeNotificationSubscription(responseListener.current);
    };
  }, [router]);

  return { expoPushToken };
}
