// src/onboarding/steps.ts

import type { WalkthroughStep, UserRole } from './types';

export const WALKTHROUGH_TARGET_IDS = {
  // Customer targets
  CUSTOMER_POST_JOB_CTA: 'customer-post-job-cta',
  CUSTOMER_OFFERS_LIST: 'customer-offers-list',
  CUSTOMER_CHAT_BUTTON: 'customer-chat-button',
  CUSTOMER_CONFIRM_COMPLETION: 'customer-confirm-completion',
  CUSTOMER_RATE_MECHANIC: 'customer-rate-mechanic',
  
  // Mechanic targets
  MECHANIC_LEADS_LIST: 'mechanic-leads-list',
  MECHANIC_SEND_OFFER: 'mechanic-send-offer',
  MECHANIC_INBOX_TAB: 'mechanic-inbox-tab',
  MECHANIC_JOB_LOCATION: 'mechanic-job-location',
  MECHANIC_EARNINGS_TAB: 'mechanic-earnings-tab',
} as const;

export const CUSTOMER_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'customer-step-1',
    targetId: WALKTHROUGH_TARGET_IDS.CUSTOMER_POST_JOB_CTA,
    title: 'Request a Mechanic',
    body: 'Describe the issue, location, and preferred time.',
    route: '/(customer)/(tabs)',
  },
  {
    id: 'customer-step-2',
    targetId: WALKTHROUGH_TARGET_IDS.CUSTOMER_OFFERS_LIST,
    title: 'Compare Offers',
    body: 'Review price, ratings, and response time.',
    route: '/(customer)/(tabs)/jobs',
  },
  {
    id: 'customer-step-3',
    targetId: WALKTHROUGH_TARGET_IDS.CUSTOMER_CHAT_BUTTON,
    title: 'Chat Safely',
    body: 'Keep communication protected inside WrenchGo.',
    route: '/(customer)/(tabs)/inbox',
  },
  {
    id: 'customer-step-4',
    targetId: WALKTHROUGH_TARGET_IDS.CUSTOMER_CONFIRM_COMPLETION,
    title: 'Complete the Job',
    body: 'Confirm work is done to close out the job.',
  },
  {
    id: 'customer-step-5',
    targetId: WALKTHROUGH_TARGET_IDS.CUSTOMER_RATE_MECHANIC,
    title: 'Rate Your Mechanic',
    body: 'Ratings help the best mechanics stand out.',
  },
];

export const MECHANIC_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'mechanic-step-1',
    targetId: WALKTHROUGH_TARGET_IDS.MECHANIC_LEADS_LIST,
    title: 'Browse Leads',
    body: 'Find nearby jobs that match your skills.',
    route: '/(mechanic)/(tabs)',
  },
  {
    id: 'mechanic-step-2',
    targetId: WALKTHROUGH_TARGET_IDS.MECHANIC_SEND_OFFER,
    title: 'Send an Offer',
    body: 'Set your price and availability.',
  },
  {
    id: 'mechanic-step-3',
    targetId: WALKTHROUGH_TARGET_IDS.MECHANIC_INBOX_TAB,
    title: 'Message Customers',
    body: 'Coordinate details right inside the app.',
    route: '/(mechanic)/(tabs)/inbox',
  },
  {
    id: 'mechanic-step-4',
    targetId: WALKTHROUGH_TARGET_IDS.MECHANIC_JOB_LOCATION,
    title: 'Get There Fast',
    body: 'Use job location to plan your route.',
  },
  {
    id: 'mechanic-step-5',
    targetId: WALKTHROUGH_TARGET_IDS.MECHANIC_EARNINGS_TAB,
    title: 'Track Earnings',
    body: 'See booked jobs and payments in one place.',
    route: '/(mechanic)/(tabs)/jobs',
  },
];

export function getWalkthroughSteps(role: UserRole): WalkthroughStep[] {
  return role === 'customer' ? CUSTOMER_WALKTHROUGH_STEPS : MECHANIC_WALKTHROUGH_STEPS;
}
