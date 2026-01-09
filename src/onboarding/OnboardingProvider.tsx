// src/onboarding/OnboardingProvider.tsx

import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { OnboardingContextValue, OnboardingState, TargetMeasurement, UserRole } from './types';
import { getWalkthroughSteps } from './steps';
import {
  loadOnboardingState,
  resetOnboardingStorage,
  setHasSeenGuide,
  setUserRole as saveUserRole,
} from './storage';
import { WalkthroughOverlay } from './WalkthroughOverlay';

const initialState: OnboardingState = {
  userRole: null,
  hasSeenCustomerGuide: false,
  hasSeenMechanicGuide: false,
  isWalkthroughActive: false,
  currentStepIndex: 0,
  currentRole: null,
};

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const targetsRef = useRef<Map<string, TargetMeasurement>>(new Map());

  // Load persisted state on mount
  useEffect(() => {
    let mounted = true;
    loadOnboardingState().then((savedState) => {
      if (mounted) {
        setState((prev) => ({
          ...prev,
          userRole: savedState.userRole,
          hasSeenCustomerGuide: savedState.hasSeenCustomerGuide,
          hasSeenMechanicGuide: savedState.hasSeenMechanicGuide,
        }));
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setUserRole = useCallback(async (role: UserRole) => {
    await saveUserRole(role);
    setState((prev) => ({ ...prev, userRole: role }));
  }, []);

  const startWalkthrough = useCallback((role: UserRole) => {
    setState((prev) => ({
      ...prev,
      isWalkthroughActive: true,
      currentStepIndex: 0,
      currentRole: role,
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const stopWalkthrough = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isWalkthroughActive: false,
      currentStepIndex: 0,
      currentRole: null,
    }));
  }, []);

  const skipWalkthrough = useCallback(async () => {
    const role = state.currentRole;
    if (role) {
      await setHasSeenGuide(role, true);
      setState((prev) => ({
        ...prev,
        isWalkthroughActive: false,
        currentStepIndex: 0,
        currentRole: null,
        hasSeenCustomerGuide: role === 'customer' ? true : prev.hasSeenCustomerGuide,
        hasSeenMechanicGuide: role === 'mechanic' ? true : prev.hasSeenMechanicGuide,
      }));
    }
  }, [state.currentRole]);

  const nextStep = useCallback(async () => {
    const role = state.currentRole;
    if (!role) return;

    const steps = getWalkthroughSteps(role);
    const nextIndex = state.currentStepIndex + 1;

    if (nextIndex >= steps.length) {
      // Completed walkthrough
      await setHasSeenGuide(role, true);
      setState((prev) => ({
        ...prev,
        isWalkthroughActive: false,
        currentStepIndex: 0,
        currentRole: null,
        hasSeenCustomerGuide: role === 'customer' ? true : prev.hasSeenCustomerGuide,
        hasSeenMechanicGuide: role === 'mechanic' ? true : prev.hasSeenMechanicGuide,
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setState((prev) => ({ ...prev, currentStepIndex: nextIndex }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [state.currentRole, state.currentStepIndex]);

  const prevStep = useCallback(() => {
    if (state.currentStepIndex > 0) {
      setState((prev) => ({ ...prev, currentStepIndex: prev.currentStepIndex - 1 }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [state.currentStepIndex]);

  const registerTarget = useCallback((id: string, measurement: TargetMeasurement) => {
    targetsRef.current.set(id, measurement);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const getTargetMeasurement = useCallback((id: string): TargetMeasurement | null => {
    return targetsRef.current.get(id) ?? null;
  }, []);

  const resetOnboarding = useCallback(async () => {
    await resetOnboardingStorage();
    setState(initialState);
  }, []);

  const currentStep = useMemo(() => {
    if (!state.currentRole || !state.isWalkthroughActive) return null;
    const steps = getWalkthroughSteps(state.currentRole);
    return steps[state.currentStepIndex] ?? null;
  }, [state.currentRole, state.currentStepIndex, state.isWalkthroughActive]);

  const totalSteps = useMemo(() => {
    if (!state.currentRole) return 0;
    return getWalkthroughSteps(state.currentRole).length;
  }, [state.currentRole]);

  const contextValue: OnboardingContextValue = useMemo(
    () => ({
      ...state,
      setUserRole,
      startWalkthrough,
      stopWalkthrough,
      skipWalkthrough,
      nextStep,
      prevStep,
      registerTarget,
      unregisterTarget,
      getTargetMeasurement,
      currentStep,
      totalSteps,
      resetOnboarding,
      isLoading,
    }),
    [
      state,
      setUserRole,
      startWalkthrough,
      stopWalkthrough,
      skipWalkthrough,
      nextStep,
      prevStep,
      registerTarget,
      unregisterTarget,
      getTargetMeasurement,
      currentStep,
      totalSteps,
      resetOnboarding,
      isLoading,
    ]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <WalkthroughOverlay />
    </OnboardingContext.Provider>
  );
}
