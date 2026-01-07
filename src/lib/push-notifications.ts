import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

let Notifications: typeof import('expo-notifications') | null = null;
let notificationsAvailable = false;

// Try to load expo-notifications - will fail in Expo Go
try {
  Notifications = require('expo-notifications');
  notificationsAvailable = true;

  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!notificationsAvailable || !Notifications) {
    return null;
  }
  
  try {
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9F1C',
      });
    }

    return token;
  } catch (error) {
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('Error saving push token:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', userId);
  } catch (error) {
    console.error('Error clearing push token:', error);
  }
}

export function addNotificationReceivedListener(callback: (notification: any) => void) {
  if (!notificationsAvailable || !Notifications) {
    return null;
  }
  try {
    return Notifications.addNotificationReceivedListener(callback);
  } catch (error) {
    return null;
  }
}

export function addNotificationResponseReceivedListener(callback: (response: any) => void) {
  if (!notificationsAvailable || !Notifications) {
    return null;
  }
  try {
    return Notifications.addNotificationResponseReceivedListener(callback);
  } catch (error) {
    return null;
  }
}

export function removeNotificationSubscription(subscription: any) {
  if (!subscription) return;
  try {
    subscription.remove();
  } catch (error) {
    // Ignore
  }
}
