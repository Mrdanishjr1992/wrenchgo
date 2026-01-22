// Dispute and comeback system constants

export const DISPUTE_STATUS = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  EVIDENCE_REQUESTED: 'evidence_requested',
  RESOLVED_CUSTOMER: 'resolved_customer',
  RESOLVED_MECHANIC: 'resolved_mechanic',
  RESOLVED_SPLIT: 'resolved_split',
  CLOSED: 'closed',
} as const;

export type DisputeStatus = typeof DISPUTE_STATUS[keyof typeof DISPUTE_STATUS];

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  [DISPUTE_STATUS.OPEN]: 'Open',
  [DISPUTE_STATUS.UNDER_REVIEW]: 'Under Review',
  [DISPUTE_STATUS.EVIDENCE_REQUESTED]: 'Evidence Requested',
  [DISPUTE_STATUS.RESOLVED_CUSTOMER]: 'Resolved (Customer)',
  [DISPUTE_STATUS.RESOLVED_MECHANIC]: 'Resolved (Mechanic)',
  [DISPUTE_STATUS.RESOLVED_SPLIT]: 'Resolved (Split)',
  [DISPUTE_STATUS.CLOSED]: 'Closed',
};

export const DISPUTE_STATUS_COLORS: Record<DisputeStatus, string> = {
  [DISPUTE_STATUS.OPEN]: '#EF4444',
  [DISPUTE_STATUS.UNDER_REVIEW]: '#F59E0B',
  [DISPUTE_STATUS.EVIDENCE_REQUESTED]: '#8B5CF6',
  [DISPUTE_STATUS.RESOLVED_CUSTOMER]: '#10B981',
  [DISPUTE_STATUS.RESOLVED_MECHANIC]: '#10B981',
  [DISPUTE_STATUS.RESOLVED_SPLIT]: '#10B981',
  [DISPUTE_STATUS.CLOSED]: '#6B7280',
};

export const DISPUTE_CATEGORY = {
  COMEBACK: 'comeback',
  QUALITY: 'quality',
  NO_SHOW: 'no_show',
  OVERCHARGE: 'overcharge',
  DAMAGE: 'damage',
  OTHER: 'other',
} as const;

export type DisputeCategory = typeof DISPUTE_CATEGORY[keyof typeof DISPUTE_CATEGORY];

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  [DISPUTE_CATEGORY.COMEBACK]: 'Issue Returned',
  [DISPUTE_CATEGORY.QUALITY]: 'Work Quality',
  [DISPUTE_CATEGORY.NO_SHOW]: 'Mechanic No-Show',
  [DISPUTE_CATEGORY.OVERCHARGE]: 'Overcharge',
  [DISPUTE_CATEGORY.DAMAGE]: 'Property Damage',
  [DISPUTE_CATEGORY.OTHER]: 'Other',
};

export const DISPUTE_RESOLUTION_TYPE = {
  REWORK: 'rework',
  PARTIAL_REFUND: 'partial_refund',
  FULL_REFUND: 'full_refund',
  CREDIT: 'credit',
  NO_ACTION: 'no_action',
  MECHANIC_FAVOR: 'mechanic_favor',
} as const;

export type DisputeResolutionType = typeof DISPUTE_RESOLUTION_TYPE[keyof typeof DISPUTE_RESOLUTION_TYPE];

export const DISPUTE_RESOLUTION_LABELS: Record<DisputeResolutionType, string> = {
  [DISPUTE_RESOLUTION_TYPE.REWORK]: 'Mechanic to Rework',
  [DISPUTE_RESOLUTION_TYPE.PARTIAL_REFUND]: 'Partial Refund',
  [DISPUTE_RESOLUTION_TYPE.FULL_REFUND]: 'Full Refund',
  [DISPUTE_RESOLUTION_TYPE.CREDIT]: 'Account Credit',
  [DISPUTE_RESOLUTION_TYPE.NO_ACTION]: 'No Action Required',
  [DISPUTE_RESOLUTION_TYPE.MECHANIC_FAVOR]: 'Resolved in Mechanic Favor',
};

export const DISPUTE_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
} as const;

export type DisputePriority = typeof DISPUTE_PRIORITY[keyof typeof DISPUTE_PRIORITY];

export const DISPUTE_PRIORITY_LABELS: Record<DisputePriority, string> = {
  [DISPUTE_PRIORITY.LOW]: 'Low',
  [DISPUTE_PRIORITY.NORMAL]: 'Normal',
  [DISPUTE_PRIORITY.HIGH]: 'High',
};

export const DISPUTE_PRIORITY_COLORS: Record<DisputePriority, string> = {
  [DISPUTE_PRIORITY.LOW]: '#6B7280',
  [DISPUTE_PRIORITY.NORMAL]: '#3B82F6',
  [DISPUTE_PRIORITY.HIGH]: '#EF4444',
};

// Default policy values
export const DISPUTE_DEFAULTS = {
  COMEBACK_WINDOW_DAYS: 14,
  MECHANIC_RESPONSE_SLA_HOURS: 12,
  EVIDENCE_DEADLINE_HOURS: 48,
};

export const CHAT_DEFAULTS = {
  POST_COMPLETION_WINDOW_HOURS: 48,
  READONLY_PERIOD_DAYS: 30,
};
