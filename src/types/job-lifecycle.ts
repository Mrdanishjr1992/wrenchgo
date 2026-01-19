// Job Lifecycle Types
// Complete type definitions for the transaction lifecycle

// =====================================================
// ENUMS
// =====================================================

export type ContractStatus = 
  | 'pending_payment'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export type CancellationReason =
  | 'customer_before_departure'
  | 'customer_after_departure'
  | 'customer_after_arrival'
  | 'customer_after_work_started'
  | 'mechanic_before_departure'
  | 'mechanic_after_departure'
  | 'mechanic_no_show'
  | 'customer_no_show'
  | 'mutual_agreement'
  | 'platform_intervention';

export type LineItemType =
  | 'base_labor'
  | 'additional_labor'
  | 'parts'
  | 'diagnostic'
  | 'travel'
  | 'platform_fee'
  | 'discount'
  | 'tax';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'auto_rejected';

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'evidence_requested'
  | 'resolved_customer'
  | 'resolved_mechanic'
  | 'resolved_split'
  | 'closed';

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'held'
  | 'cancelled';

export type JobEventType =
  | 'quote_accepted'
  | 'contract_created'
  | 'payment_authorized'
  | 'payment_failed'
  | 'mechanic_departed'
  | 'mechanic_arrived'
  | 'customer_confirmed_arrival'
  | 'work_started'
  | 'line_item_added'
  | 'line_item_approved'
  | 'line_item_rejected'
  | 'work_completed_mechanic'
  | 'work_completed_customer'
  | 'job_finalized'
  | 'payment_captured'
  | 'payout_initiated'
  | 'payout_completed'
  | 'cancelled'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'refund_issued'
  | 'message_sent'
  | 'system_note'
  | 'quote_expired_conflict';

// =====================================================
// INTERFACES
// =====================================================

export interface JobContract {
  id: string;
  job_id: string;
  quote_id: string;
  customer_id: string;
  mechanic_id: string;

  status: ContractStatus;

  // Amounts
  quoted_price_cents: number;
  platform_fee_cents: number;
  estimated_hours: number | null;
  subtotal_cents: number;
  total_customer_cents: number;
  mechanic_commission_cents: number;
  mechanic_payout_cents: number;

  // Promo discount (customer)
  promo_discount_cents?: number;
  promo_credit_type?: string;
  original_platform_fee_cents?: number;

  // Mechanic promo discount
  mechanic_promo_discount_cents?: number;
  mechanic_promo_credit_type?: string;
  original_mechanic_commission_cents?: number;
  applied_mechanic_promo_credit_id?: string;

  // Payment
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  payment_authorized_at: string | null;
  payment_captured_at: string | null;

  // Terms
  terms_version: string;
  terms_accepted_at: string;

  // Cancellation
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: CancellationReason | null;
  cancellation_note: string | null;
  refund_amount_cents: number | null;

  // Booking window (for conflict detection)
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  contract_id: string;
  
  item_type: LineItemType;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  
  part_number: string | null;
  part_source: string | null;
  
  approval_status: ApprovalStatus;
  requires_approval: boolean;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  approval_deadline: string | null;
  
  added_by: string;
  added_by_role: 'customer' | 'mechanic';
  notes: string | null;
  sort_order: number;
  
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  contract_id: string | null;
  
  event_type: JobEventType;
  actor_id: string | null;
  actor_role: 'customer' | 'mechanic' | null;
  
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  amount_cents: number | null;
  
  visible_to_customer: boolean;
  visible_to_mechanic: boolean;
  is_system_message: boolean;
  
  created_at: string;
}

export interface JobProgress {
  id: string;
  job_id: string;
  contract_id: string | null;
  
  mechanic_departed_at: string | null;
  mechanic_arrived_at: string | null;
  customer_confirmed_arrival_at: string | null;
  work_started_at: string | null;
  
  mechanic_completed_at: string | null;
  customer_completed_at: string | null;
  finalized_at: string | null;
  
  mechanic_departure_lat: number | null;
  mechanic_departure_lng: number | null;
  mechanic_arrival_lat: number | null;
  mechanic_arrival_lng: number | null;
  
  estimated_arrival_at: string | null;
  actual_work_duration_minutes: number | null;
  
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  job_id: string;
  contract_id: string | null;
  
  filed_by: string;
  filed_by_role: 'customer' | 'mechanic';
  filed_against: string;
  
  status: DisputeStatus;
  
  category: string;
  description: string;
  desired_resolution: string | null;
  evidence_urls: string[];
  
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  customer_refund_cents: number | null;
  mechanic_adjustment_cents: number | null;
  
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

export interface JobMedia {
  id: string;
  job_id: string;
  contract_id: string | null;
  
  uploaded_by: string;
  uploaded_by_role: 'customer' | 'mechanic';
  
  media_type: 'image' | 'video';
  media_category: 'before' | 'during' | 'after' | 'issue' | 'receipt';
  
  bucket: string;
  path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  
  caption: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  
  taken_at: string | null;
  created_at: string;
}

// =====================================================
// COMPOSITE TYPES
// =====================================================

export interface JobWithContract {
  id: string;
  title: string;
  description: string | null;
  status: string;
  customer_id: string;
  vehicle_id: string | null;
  accepted_mechanic_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  contract: JobContract | null;
  progress: JobProgress | null;
  line_items: InvoiceLineItem[];
  events: JobEvent[];
}

export interface Invoice {
  contract: JobContract;
  line_items: InvoiceLineItem[];
  
  // Calculated
  approved_items: InvoiceLineItem[];
  pending_items: InvoiceLineItem[];
  rejected_items: InvoiceLineItem[];
  
  approved_subtotal_cents: number;
  pending_subtotal_cents: number;
}

// =====================================================
// FUNCTION RESPONSE TYPES
// =====================================================

export interface AcceptQuoteResponse {
  success: boolean;
  error?: string;
  error_code?: string;
  contract_id?: string;
  total_cents?: number;
  mechanic_id?: string;
  requires_terms?: boolean;
  requires_acknowledgement?: boolean;
  terms_version?: string;
  job_id?: string;
  already_exists?: boolean;
  expired_quote_ids?: string[];
  expired_count?: number;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  mechanic_promo_applied?: boolean;
  mechanic_promo_discount_cents?: number;
  conflict_contract_id?: string;
}

export interface JobActionResponse {
  success: boolean;
  error?: string;
}

export interface AddLineItemResponse {
  success: boolean;
  error?: string;
  line_item_id?: string;
  total_cents?: number;
  approval_deadline?: string;
}

export interface CancelJobResponse {
  success: boolean;
  error?: string;
  refund_amount_cents?: number;
}

// =====================================================
// UI STATE TYPES
// =====================================================

export type JobPhase =
  | 'quote_accepted'      // Contract created, awaiting mechanic departure
  | 'mechanic_en_route'   // Mechanic departed, heading to location
  | 'awaiting_arrival_confirmation'  // Mechanic arrived, awaiting customer confirmation
  | 'ready_to_start'      // Arrival confirmed, ready to start work
  | 'work_in_progress'    // Work has started
  | 'awaiting_completion' // One party confirmed, waiting for other
  | 'completed'           // Both confirmed, job done
  | 'cancelled'           // Job was cancelled
  | 'disputed';           // Under dispute

export function getJobPhase(progress: JobProgress | null, contract: JobContract | null): JobPhase {
  if (!contract) return 'quote_accepted';

  if (contract.status === 'cancelled') return 'cancelled';
  if (contract.status === 'disputed') return 'disputed';
  if (contract.status === 'completed') return 'completed';

  if (!progress) return 'quote_accepted';

  if (progress.finalized_at) return 'completed';
  if (progress.mechanic_completed_at || progress.customer_completed_at) return 'awaiting_completion';
  if (progress.work_started_at) return 'work_in_progress';
  if (progress.customer_confirmed_arrival_at) return 'ready_to_start';
  if (progress.mechanic_arrived_at && !progress.customer_confirmed_arrival_at) return 'awaiting_arrival_confirmation';
  if (progress.mechanic_departed_at) return 'mechanic_en_route';

  return 'quote_accepted';
}


export function getPhaseLabel(phase: JobPhase): string {
  switch (phase) {
    case 'quote_accepted': return 'Quote Accepted';
    case 'mechanic_en_route': return 'Mechanic En Route';
    case 'awaiting_arrival_confirmation': return 'Confirm Arrival';
    case 'ready_to_start': return 'Ready to Start';
    case 'work_in_progress': return 'Work In Progress';
    case 'awaiting_completion': return 'Awaiting Confirmation';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'disputed': return 'Under Dispute';
    default: return 'Unknown';
  }
}

export function canCustomerCancel(progress: JobProgress | null): { allowed: boolean; reason: CancellationReason | null; fee: number } {
  if (!progress) {
    return { allowed: true, reason: 'customer_before_departure', fee: 0 };
  }
  
  if (progress.work_started_at) {
    return { allowed: false, reason: null, fee: 0 };
  }
  
  if (progress.customer_confirmed_arrival_at) {
    return { allowed: true, reason: 'customer_after_arrival', fee: 2500 };
  }
  
  if (progress.mechanic_departed_at) {
    return { allowed: true, reason: 'customer_after_departure', fee: 2500 };
  }
  
  return { allowed: true, reason: 'customer_before_departure', fee: 0 };
}

// =====================================================
// FEE CONSTANTS
// =====================================================

export const PLATFORM_FEE_CENTS = 1500; // $15
export const MECHANIC_COMMISSION_RATE = 0.12; // 12%
export const MECHANIC_COMMISSION_CAP_CENTS = 5000; // $50
export const TRAVEL_FEE_CENTS = 2500; // $25

export function calculateMechanicCommission(priceCents: number): number {
  return Math.min(Math.round(priceCents * MECHANIC_COMMISSION_RATE), MECHANIC_COMMISSION_CAP_CENTS);
}

export function calculateMechanicPayout(priceCents: number): number {
  return priceCents - calculateMechanicCommission(priceCents);
}

export function calculateCustomerTotal(priceCents: number): number {
  return priceCents + PLATFORM_FEE_CENTS;
}

// =====================================================
// FORMATTING HELPERS
// =====================================================

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
