// src/onboarding/OnboardingContext.ts
import { createContext } from 'react';
import type { OnboardingContextValue } from './types';

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);
