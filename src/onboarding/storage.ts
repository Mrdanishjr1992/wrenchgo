// src/onboarding/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserRole } from './types';

const STORAGE_KEYS = {
  USER_ROLE: '@wrenchgo:user_role',
  HAS_SEEN_CUSTOMER_GUIDE: '@wrenchgo:has_seen_customer_guide',
  HAS_SEEN_MECHANIC_GUIDE: '@wrenchgo:has_seen_mechanic_guide',
} as const;

export async function getUserRole(): Promise<UserRole | null> {
  try {
    const role = await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
    if (role === 'customer' || role === 'mechanic') {
      return role;
    }
    return null;
  } catch (error) {
    console.warn('Failed to get user role from storage:', error);
    return null;
  }
}

export async function setUserRole(role: UserRole): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  } catch (error) {
    console.warn('Failed to save user role to storage:', error);
  }
}

export async function getHasSeenGuide(role: UserRole): Promise<boolean> {
  try {
    const key = role === 'customer' 
      ? STORAGE_KEYS.HAS_SEEN_CUSTOMER_GUIDE 
      : STORAGE_KEYS.HAS_SEEN_MECHANIC_GUIDE;
    const value = await AsyncStorage.getItem(key);
    return value === 'true';
  } catch (error) {
    console.warn('Failed to get guide seen status from storage:', error);
    return false;
  }
}

export async function setHasSeenGuide(role: UserRole, seen: boolean): Promise<void> {
  try {
    const key = role === 'customer' 
      ? STORAGE_KEYS.HAS_SEEN_CUSTOMER_GUIDE 
      : STORAGE_KEYS.HAS_SEEN_MECHANIC_GUIDE;
    await AsyncStorage.setItem(key, seen ? 'true' : 'false');
  } catch (error) {
    console.warn('Failed to save guide seen status to storage:', error);
  }
}

export async function loadOnboardingState(): Promise<{
  userRole: UserRole | null;
  hasSeenCustomerGuide: boolean;
  hasSeenMechanicGuide: boolean;
}> {
  try {
    const [roleValue, customerGuide, mechanicGuide] = await AsyncStorage.multiGet([
      STORAGE_KEYS.USER_ROLE,
      STORAGE_KEYS.HAS_SEEN_CUSTOMER_GUIDE,
      STORAGE_KEYS.HAS_SEEN_MECHANIC_GUIDE,
    ]);

    let userRole: UserRole | null = null;
    if (roleValue[1] === 'customer' || roleValue[1] === 'mechanic') {
      userRole = roleValue[1];
    }

    return {
      userRole,
      hasSeenCustomerGuide: customerGuide[1] === 'true',
      hasSeenMechanicGuide: mechanicGuide[1] === 'true',
    };
  } catch (error) {
    console.warn('Failed to load onboarding state from storage:', error);
    return {
      userRole: null,
      hasSeenCustomerGuide: false,
      hasSeenMechanicGuide: false,
    };
  }
}

export async function resetOnboardingStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_ROLE,
      STORAGE_KEYS.HAS_SEEN_CUSTOMER_GUIDE,
      STORAGE_KEYS.HAS_SEEN_MECHANIC_GUIDE,
    ]);
  } catch (error) {
    console.warn('Failed to reset onboarding storage:', error);
  }
}
