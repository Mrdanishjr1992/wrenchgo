export const VERIFICATION_DOC_TYPES = {
  ID_FRONT: 'id_front',
  ID_BACK: 'id_back',
  SELFIE_WITH_ID: 'selfie_with_id',
  INSURANCE: 'insurance',
} as const;

export type VerificationDocType = typeof VERIFICATION_DOC_TYPES[keyof typeof VERIFICATION_DOC_TYPES];

export const VERIFICATION_DOC_LABELS: Record<VerificationDocType, string> = {
  id_front: 'ID Card (Front)',
  id_back: 'ID Card (Back)',
  selfie_with_id: 'Selfie holding your ID',
  insurance: 'Insurance Certificate',
};

export const VERIFICATION_DOC_HINTS: Partial<Record<VerificationDocType, string>> = {
  selfie_with_id: 'For safety, we verify that the person matches the ID.',
};

export const VERIFICATION_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  PAUSED: 'paused',
  REMOVED: 'removed',
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending_verification: 'Pending Verification',
  active: 'Active',
  paused: 'Paused',
  removed: 'Removed',
};

export const DOC_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type DocStatus = typeof DOC_STATUS[keyof typeof DOC_STATUS];

export const VETTING_REVIEW_STATUS = {
  PENDING: 'pending',
  PASS: 'pass',
  FAIL: 'fail',
  NEEDS_MORE_INFO: 'needs_more_info',
} as const;

export type VettingReviewStatus = typeof VETTING_REVIEW_STATUS[keyof typeof VETTING_REVIEW_STATUS];

export interface VettingPrompt {
  key: string;
  text: string;
  placeholder: string;
  minLength: number;
}

export const VETTING_PROMPTS: VettingPrompt[] = [
  {
    key: 'NO_START_FIRST_CHECKS',
    text: 'A customer says their car won\'t start. What checks do you perform before attempting any repair?',
    placeholder: 'Describe your diagnostic approach...',
    minLength: 50,
  },
  {
    key: 'BRAKE_COMEBACK_DIAG',
    text: 'A customer comes back saying the brakes you serviced last week are squeaking. How do you handle this?',
    placeholder: 'Explain how you would diagnose and resolve...',
    minLength: 50,
  },
  {
    key: 'WHEN_REFUSE_JOB',
    text: 'Describe a situation where you would refuse to take on a job. Why would you decline?',
    placeholder: 'Give an example and your reasoning...',
    minLength: 50,
  },
  {
    key: 'EXPLAIN_EXTRA_COST',
    text: 'During a repair, you discover additional work is needed. How do you communicate this to the customer?',
    placeholder: 'Describe your communication approach...',
    minLength: 50,
  },
  {
    key: 'JOBS_YOU_WONT_TAKE',
    text: 'What types of jobs or repairs are outside your expertise or comfort zone?',
    placeholder: 'Be honest about your limitations...',
    minLength: 30,
  },
];

export const REQUIRED_DOCS_COUNT = 4;
export const REQUIRED_VETTING_COUNT = VETTING_PROMPTS.length;

// =====================================================
// PHASE 2: TIER SYSTEM
// =====================================================

export const MECHANIC_TIER = {
  PROBATION: 'probation',
  STANDARD: 'standard',
  TRUSTED: 'trusted',
} as const;

export type MechanicTier = typeof MECHANIC_TIER[keyof typeof MECHANIC_TIER];

export const MECHANIC_TIER_LABELS: Record<MechanicTier, string> = {
  probation: 'Probation',
  standard: 'Standard',
  trusted: 'Trusted',
};

export const MECHANIC_TIER_COLORS: Record<MechanicTier, string> = {
  probation: '#F59E0B', // amber/warning
  standard: '#3B82F6', // blue
  trusted: '#10B981', // green/success
};

export const MECHANIC_TIER_DESCRIPTIONS: Record<MechanicTier, string> = {
  probation: 'New mechanics start here with limited job access and quote caps.',
  standard: 'Full access to all job types and quote amounts.',
  trusted: 'Priority access and enhanced visibility to customers.',
};

// =====================================================
// PHASE 2: STRIKE SYSTEM
// =====================================================

export const STRIKE_REASONS = {
  POOR_QUALITY_WORK: 'poor_quality_work',
  NO_SHOW: 'no_show',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  POLICY_VIOLATION: 'policy_violation',
  UNPROFESSIONAL_CONDUCT: 'unprofessional_conduct',
  SAFETY_CONCERN: 'safety_concern',
  FRAUD_SUSPECTED: 'fraud_suspected',
  OTHER: 'other',
} as const;

export type StrikeReason = typeof STRIKE_REASONS[keyof typeof STRIKE_REASONS];

export const STRIKE_REASON_LABELS: Record<StrikeReason, string> = {
  poor_quality_work: 'Poor Quality Work',
  no_show: 'No Show',
  customer_complaint: 'Customer Complaint',
  policy_violation: 'Policy Violation',
  unprofessional_conduct: 'Unprofessional Conduct',
  safety_concern: 'Safety Concern',
  fraud_suspected: 'Fraud Suspected',
  other: 'Other',
};

export const STRIKE_SEVERITY_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Moderate',
  3: 'Severe',
};

// =====================================================
// PHASE 2: LEAD DECISION TRACKING
// =====================================================

export const LEAD_DECISION = {
  VIEWED: 'viewed',
  QUOTED: 'quoted',
  DECLINED: 'declined',
} as const;

export type LeadDecision = typeof LEAD_DECISION[keyof typeof LEAD_DECISION];

export const DECLINE_REASONS = [
  'Too far away',
  'Not my specialty',
  'Schedule conflict',
  'Price too low',
  'Complex job',
  'Other',
] as const;

// =====================================================
// PHASE 2: PROBATION DEFAULTS
// =====================================================

export const PROBATION_DEFAULTS = {
  MAX_QUOTE_CENTS: 25000, // $250
  MAX_RADIUS_MILES: 15,
  BLOCKED_SYMPTOM_KEYS: ['engine_internal', 'transmission_rebuild', 'electrical_complex'],
} as const;

export const STRIKE_THRESHOLDS = {
  AUTO_PAUSE: 2,
  AUTO_REMOVE: 3,
} as const;