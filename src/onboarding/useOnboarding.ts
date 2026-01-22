// src/onboarding/useOnboarding.ts

import { useContext } from 'react';
import { OnboardingContext } from './OnboardingContext';
import type { OnboardingContextValue } from './types';

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
