// src/onboarding/types.ts

export type UserRole = 'customer' | 'mechanic';

export interface WalkthroughStep {
  id: string;
  targetId: string;
  title: string;
  body: string;
  route?: string; // Optional route hint for cross-screen targets
}

export interface TargetMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
}

export interface OnboardingState {
  userRole: UserRole | null;
  hasSeenCustomerGuide: boolean;
  hasSeenMechanicGuide: boolean;
  isWalkthroughActive: boolean;
  currentStepIndex: number;
  currentRole: UserRole | null;
}

export interface OnboardingContextValue extends OnboardingState {
  // Role management
  setUserRole: (role: UserRole) => Promise<void>;
  
  // Walkthrough control
  startWalkthrough: (role: UserRole) => void;
  stopWalkthrough: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipWalkthrough: () => Promise<void>;
  
  // Target registration
  registerTarget: (id: string, measurement: TargetMeasurement) => void;
  unregisterTarget: (id: string) => void;
  getTargetMeasurement: (id: string) => TargetMeasurement | null;
  
  // Current step info
  currentStep: WalkthroughStep | null;
  totalSteps: number;
  
  // Dev utilities
  resetOnboarding: () => Promise<void>;
  isLoading: boolean;
}
