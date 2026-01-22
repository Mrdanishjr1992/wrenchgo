export type MessageAction = 'blocked' | 'masked' | 'warned' | 'allowed';
export type ViolationTier = 'education' | 'warning' | 'restriction' | 'review';
export type ChatRestrictionType = 'templated_only' | 'suspended' | 'read_only';
export type ChatState = 'open' | 'restricted' | 'read_only' | 'closed';

export interface DetectedPattern {
  type: string;
  pattern: string;
  confidence: number;
}

export interface ContactInfoDetection {
  patterns_found: DetectedPattern[];
  risk_score: number;
}

export interface LegitimatePattern {
  type: string;
  pattern: string;
  reason: string;
}

export interface MessageRiskAssessment {
  risk_score: number;
  recommended_action: MessageAction;
  detected_patterns: DetectedPattern[];
  legitimate_patterns: LegitimatePattern[];
  context_factors: {
    account_age_days: number;
    completed_jobs: number;
    violation_count: number;
    job_stage: string;
  };
}

export interface MessageAuditLog {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  detected_patterns: DetectedPattern[];
  legitimate_patterns: LegitimatePattern[];
  risk_score: number;
  action_taken: MessageAction;
  masked_text?: string;
  job_stage?: string;
  account_age_days?: number;
  completed_jobs?: number;
  violation_count?: number;
  created_at: string;
}

export interface UserViolation {
  id: string;
  user_id: string;
  violation_type: string;
  severity: ViolationTier;
  message_audit_id?: string;
  details: any;
  created_at: string;
}

export interface ChatRestriction {
  id: string;
  user_id: string;
  restriction_type: ChatRestrictionType;
  reason: string;
  applied_by?: string;
  expires_at?: string;
  created_at: string;
}

export interface PreferredMechanic {
  id: string;
  customer_id: string;
  mechanic_id: string;
  jobs_completed: number;
  total_spent: number;
  commission_tier: number;
  last_job_at: string;
  created_at: string;
  mechanic?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    rating?: number;
  };
}

export interface ChatLifecycleConfig {
  id: string;
  job_stage: string;
  chat_state: ChatState;
  allow_contact_info: boolean;
  strictness_level: number;
  post_completion_hours?: number;
  description?: string;
}

export interface ScanMessageRequest {
  message_text: string;
  recipient_id: string;
  job_id?: string;
}

export interface ScanMessageResponse {
  allowed: boolean;
  action: MessageAction;
  reason?: string;
  message?: string;
  risk_score?: number;
  patterns_detected?: DetectedPattern[];
  original_content?: string;
  masked_content?: string;
  warning_message?: string;
  show_soft_warning?: boolean;
  show_rebook_button?: boolean;
  restriction_expires_at?: string;
  requires_human_review?: boolean;
}

export interface ChatStatusResponse {
  can_send: boolean;
  chat_state: ChatState;
  restriction_type?: ChatRestrictionType;
  message?: string;
  show_buttons?: boolean;
  button_actions?: string[];
  expires_at?: string;
}

export interface ViolationHistory {
  total_violations: number;
  education_count: number;
  warning_count: number;
  restriction_count: number;
  review_count: number;
  current_tier: ViolationTier;
  last_violation_at?: string;
}

export interface RecordViolationRequest {
  user_id: string;
  violation_type: string;
  message_audit_id?: string;
  details?: any;
}

export interface UpdatePreferredMechanicRequest {
  customer_id: string;
  mechanic_id: string;
  job_value: number;
}
