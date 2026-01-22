/**
 * WrenchGo Database Types
 * Generated from migrations - KEEP IN SYNC
 */

// =====================================================
// ENUMS
// =====================================================

export type UserRole = 'customer' | 'mechanic';
export type ThemeMode = 'light' | 'dark' | 'system';
export type JobStatus =
  | 'draft'
  | 'searching'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'work_in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' | 'declined' | 'expired_conflict';
export type PaymentStatus = 'pending' | 'processing' | 'authorized' | 'requires_action' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
export type DisputeStatus = 'open' | 'pending_response' | 'in_review' | 'escalated' | 'resolved' | 'closed';
export type PayoutStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'held';
export type SupportStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
export type VerificationStatus = 'pending_verification' | 'active' | 'paused' | 'removed';
export type ContractStatus = 'active' | 'completed' | 'cancelled' | 'disputed';

// =====================================================
// CORE TABLES
// =====================================================

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  theme_preference: ThemeMode;
  city: string | null;
  state: string | null;
  home_lat: number | null;
  home_lng: number | null;
  push_token: string | null;
  service_lat: number | null;
  service_lng: number | null;
  service_zip: string | null;
  hub_id: string | null;
  location_hash: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  license_plate: string | null;
  color: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  accepted_mechanic_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  symptom_key: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  job_lat: number | null;
  job_lng: number | null;
  hub_id: string | null;
  preferred_time: string | null;
  scheduled_at: string | null;
  estimated_duration_minutes: number;
  completed_at: string | null;
  cancelled_at: string | null;
  final_price_cents: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteRequest {
  id: string;
  job_id: string;
  mechanic_id: string;
  customer_id: string;
  status: QuoteStatus;
  price_cents: number | null;
  message: string | null;
  expires_at: string | null;
  responded_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  job_id: string;
  mechanic_id: string;
  price_cents: number | null;
  estimated_hours: number | null;
  notes: string | null;
  status: QuoteStatus;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  conflict_status_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: UserRole | null;
  overall_rating: number;
  performance_rating: number | null;
  timing_rating: number | null;
  cost_rating: number | null;
  comment: string | null;
  is_hidden: boolean;
  is_visible: boolean;
  made_visible_at: string | null;
  visibility_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MECHANIC TABLES
// =====================================================

export interface MechanicProfile {
  id: string;
  bio: string | null;
  years_experience: number | null;
  hourly_rate_cents: number | null;
  service_radius_km: number;
  mobile_service: boolean;
  is_available: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  verification_status: VerificationStatus;
  verification_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  key: string;
  label: string;
  category: string | null;
  created_at: string;
}

export interface Tool {
  key: string;
  label: string;
  category: string | null;
  created_at: string;
}

export interface SafetyMeasure {
  key: string;
  label: string;
  created_at: string;
}

export interface MechanicSkill {
  id: string;
  mechanic_id: string;
  skill_key: string;
  created_at: string;
}

export interface MechanicTool {
  id: string;
  mechanic_id: string;
  tool_key: string;
  created_at: string;
}

export interface MechanicSafety {
  id: string;
  mechanic_id: string;
  safety_key: string;
  created_at: string;
}

// =====================================================
// SERVICE AREA TABLES
// =====================================================

export interface ServiceHub {
  id: string;
  name: string;
  slug: string;
  zip: string;
  lat: number;
  lng: number;
  max_radius_miles: number;
  active_radius_miles: number;
  is_active: boolean;
  invite_only: boolean;
  auto_expand_enabled: boolean;
  launch_date: string | null;
  graduated_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Waitlist {
  id: string;
  email: string;
  phone: string | null;
  zip: string;
  lat: number | null;
  lng: number | null;
  nearest_hub_id: string | null;
  distance_miles: number | null;
  ring: number | null;
  user_type: 'customer' | 'mechanic' | null;
  service_needed: string | null;
  services_offered: string[] | null;
  years_experience: number | null;
  willing_travel_miles: number | null;
  invited_at: string | null;
  converted_at: string | null;
  created_at: string;
}

// =====================================================
// JOB LIFECYCLE TABLES
// =====================================================

export interface JobContract {
  id: string;
  job_id: string;
  customer_id: string;
  mechanic_id: string;
  quote_id: string;
  agreed_price_cents: number;
  platform_fee_cents: number;
  mechanic_payout_cents: number;
  status: ContractStatus;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  job_id: string;
  contract_id: string | null;
  filed_by: string;
  filed_by_role: UserRole;
  filed_against: string;
  status: DisputeStatus;
  category: string;
  description: string;
  desired_resolution: string | null;
  evidence_urls: string[] | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  customer_refund_cents: number | null;
  mechanic_adjustment_cents: number | null;
  internal_notes: string | null;
  assigned_to: string | null;
  priority: string;
  response_deadline: string | null;
  evidence_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payout {
  id: string;
  contract_id: string;
  mechanic_id: string;
  gross_amount_cents: number;
  commission_cents: number;
  adjustments_cents: number;
  net_amount_cents: number;
  status: PayoutStatus;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  scheduled_for: string | null;
  processed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  held_at: string | null;
  hold_reason: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SUPPORT TABLES
// =====================================================

export interface SupportRequest {
  id: string;
  user_id: string | null;
  job_id: string | null;
  category: string;
  message: string;
  screenshot_url: string | null;
  metadata: Record<string, unknown> | null;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SYMPTOM TABLES
// =====================================================

export interface Symptom {
  key: string;
  label: string;
  icon: string | null;
  created_at: string;
}

export interface SymptomMapping {
  id: string;
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  quote_strategy: string | null;
  customer_explainer: string | null;
  mechanic_notes: string | null;
  required_skill_keys: string[];
  suggested_tool_keys: string[];
  required_safety_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface EducationCard {
  id: string;
  symptom_key: string;
  card_key: string;
  title: string;
  summary: string | null;
  why_it_happens: string | null;
  what_we_check: string | null;
  is_it_safe: string | null;
  prep_before_visit: string | null;
  quote_expectation: string | null;
  red_flags: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface SymptomEducation {
  id: string;
  symptom_key: string;
  title: string;
  summary: string | null;
  is_it_safe: string | null;
  what_we_check: string | null;
  how_quotes_work: string | null;
  created_at: string;
  updated_at: string;
}

export interface SymptomQuestion {
  id: string;
  symptom_key: string;
  question_key: string;
  question_text: string;
  question_type: string;
  options: unknown | null;
  affects_safety: boolean;
  affects_quote: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// COMMUNICATION TABLES
// =====================================================

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  key: string | null;
  bucket: string;
  path: string | null;
  public_url: string | null;
  content_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  uploaded_by: string | null;
  job_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PAYMENT TABLES
// =====================================================

export interface MechanicStripeAccount {
  id: string;
  mechanic_id: string;
  stripe_account_id: string;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerPaymentMethod {
  id: string;
  customer_id: string;
  stripe_payment_method_id: string;
  is_default: boolean;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  customer_id: string;
  mechanic_id: string;
  stripe_payment_intent_id: string | null;
  client_secret: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  status: PaymentStatus;
  paid_at: string | null;
  refunded_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// DATABASE SCHEMA TYPE (for compile-time validation)
// =====================================================

export interface DatabaseSchema {
  profiles: Profile;
  vehicles: Vehicle;
  jobs: Job;
  quote_requests: QuoteRequest;
  quotes: Quote;
  reviews: Review;
  mechanic_profiles: MechanicProfile;
  skills: Skill;
  tools: Tool;
  safety_measures: SafetyMeasure;
  mechanic_skills: MechanicSkill;
  mechanic_tools: MechanicTool;
  mechanic_safety: MechanicSafety;
  service_hubs: ServiceHub;
  waitlist: Waitlist;
  job_contracts: JobContract;
  disputes: Dispute;
  payouts: Payout;
  support_requests: SupportRequest;
  symptoms: Symptom;
  symptom_mappings: SymptomMapping;
  education_cards: EducationCard;
  symptom_education: SymptomEducation;
  symptom_questions: SymptomQuestion;
  messages: Message;
  notifications: Notification;
  media_assets: MediaAsset;
  mechanic_stripe_accounts: MechanicStripeAccount;
  customer_payment_methods: CustomerPaymentMethod;
  payments: Payment;
}

export type TableName = keyof DatabaseSchema;
export type TableRow<T extends TableName> = DatabaseSchema[T];
export type TableColumn<T extends TableName> = keyof DatabaseSchema[T];

// =====================================================
// RPC FUNCTION TYPES
// =====================================================

export interface SetUserRoleResponse {
  success: boolean;
  error?: string;
  role?: string;
}

export interface MechanicLeadRow {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  symptom_key: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  preferred_time: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  distance_miles: number;
  created_at: string;
}

export interface MechanicProfileFull {
  profile: MechanicProfile | null;
  user: Pick<Profile, 'full_name' | 'display_name' | 'avatar_url' | 'city' | 'state' | 'home_lat' | 'home_lng'> | null;
  skills: Skill[];
  tools: Tool[];
  safety: SafetyMeasure[];
}

export interface StripeAccountStatus {
  has_account: boolean;
  stripe_account_id: string | null;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  error?: string;
  payment_id?: string;
  amount_cents?: number;
  platform_fee_cents?: number;
}

// =====================================================
// INSERT TYPES (for creating new records)
// =====================================================

export type ProfileInsert = Partial<Omit<Profile, 'created_at' | 'updated_at'>>;
export type VehicleInsert = Omit<Vehicle, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type JobInsert = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'completed_at' | 'cancelled_at'>;
export type QuoteRequestInsert = Omit<QuoteRequest, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'responded_at'>;
export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type MessageInsert = Omit<Message, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'read_at'>;
export type NotificationInsert = Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'read_at'>;

// =====================================================
// UPDATE TYPES
// =====================================================

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;
export type VehicleUpdate = Partial<Omit<Vehicle, 'id' | 'customer_id' | 'created_at'>>;
export type JobUpdate = Partial<Omit<Job, 'id' | 'customer_id' | 'created_at'>>;
export type MechanicProfileUpdate = Partial<Omit<MechanicProfile, 'id' | 'created_at'>>;
