import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from '../lib/push-notifications';
import { supabase } from '../lib/supabase';

export function usePushNotifications() {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Register for push notifications
      const token = await registerForPushNotificationsAsync();
      if (token && mounted) {
        setExpoPushToken(token);
        await savePushToken(user.id, token);
      }
    };

    setup();

    // Handle notifications received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle notification taps
    responseListener.current = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      
      // Navigate based on notification data
      if (data?.entityType && data?.entityId) {
        if (data.entityType === 'job') {
          // Check user role and navigate accordingly
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

    return () => {
      mounted = false;
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router]);

  return { expoPushToken };
}
