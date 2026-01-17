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