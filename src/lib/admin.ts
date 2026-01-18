import { supabase } from './supabase';

// =====================================================
// Types
// =====================================================

export interface AdminJob {
  id: string;
  title: string;
  status: string;
  customer_id: string;
  customer_name: string;
  mechanic_id: string | null;
  mechanic_name: string | null;
  hub_id: string | null;
  hub_name: string | null;
  created_at: string;
  completed_at: string | null;
  quote_count: number;
  has_dispute: boolean;
  has_support_ticket: boolean;
}

export interface AdminJobDetail {
  job: {
    id: string;
    title: string;
    description: string;
    status: string;
    symptom_key: string | null;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    hub_id: string | null;
    hub_name: string | null;
    location_lat: number;
    location_lng: number;
    location_address: string;
    vehicle_id: string | null;
    vehicle_year: number | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_nickname: string | null;
    preferred_time: string | null;
    final_price_cents: number | null;
    created_at: string;
    scheduled_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
  };
  quotes: Array<{
    id: string;
    mechanic_id: string;
    mechanic_name: string;
    status: string;
    price_cents: number;
    notes: string | null;
    created_at: string;
  }>;
  contract: {
    id: string;
    mechanic_id: string;
    mechanic_name: string;
    status: string;
    quoted_price_cents: number;
    subtotal_cents: number;
    total_customer_cents: number;
    mechanic_payout_cents: number;
    accepted_at: string;
    started_at: string | null;
    completed_at: string | null;
  } | null;
  events: Array<{
    id: string;
    event_type: string;
    actor_id: string;
    actor_role: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    category: string;
    priority: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  support_requests: Array<{
    id: string;
    status: string;
    category: string;
    message: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount_cents: number;
    created_at: string;
    paid_at: string | null;
    refunded_at: string | null;
  }>;
}

export interface AdminMechanic {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  verification_status: string;
  tier: string;
  hub_id: string | null;
  hub_name: string | null;
  rating_avg: number | null;
  rating_count: number;
  jobs_completed: number;
  is_available: boolean;
  created_at: string;
}

export interface AdminMechanicDetail {
  mechanic: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: string;
    city: string | null;
    state: string | null;
    hub_id: string | null;
    hub_name: string | null;
    verification_status: string;
    verification_reason: string | null;
    tier: string;
    bio: string | null;
    years_experience: number | null;
    hourly_rate_cents: number | null;
    service_radius_km: number | null;
    mobile_service: boolean;
    is_available: boolean;
    rating_avg: number | null;
    rating_count: number;
    jobs_completed: number;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
    created_at: string;
    updated_at: string;
  };
  documents: Array<{
    id: string;
    doc_type: string;
    status: string;
    uploaded_at: string;
    reviewed_at: string | null;
    review_notes: string | null;
  }>;
  vetting: Array<{
    id: string;
    prompt_key: string;
    prompt_text: string;
    response_text: string;
    created_at: string;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    customer_name: string;
    created_at: string;
    completed_at: string | null;
  }>;
  reviews: Array<{
    id: string;
    overall_rating: number;
    comment: string | null;
    reviewer_name: string;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    job_id: string;
    status: string;
    category: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  support_requests: Array<{
    id: string;
    job_id: string | null;
    category: string;
    status: string;
    message: string;
    created_at: string;
  }>;
}

export interface AdminSupportRequestEnriched {
  support_request_id: string;
  status: string;
  category: string;
  message: string;
  created_at: string;
  last_updated_at: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_email: string;
  user_phone: string;
  job_id: string | null;
  hub_id: string | null;
  has_screenshot: boolean;
}

export interface AdminSupportRequestDetail {
  support_request: {
    id: string;
    user_id: string;
    job_id: string | null;
    category: string;
    message: string;
    screenshot_url: string | null;
    status: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
    role: string;
    city: string | null;
    state: string | null;
    hub_id: string | null;
    created_at: string;
  };
  job: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    location_address: string;
    symptom_key: string | null;
    accepted_mechanic_id: string | null;
    customer_id: string;
  } | null;
  contract: {
    id: string;
    mechanic_id: string;
    mechanic_name: string;
    status: string;
    quoted_price_cents: number;
    accepted_at: string;
    completed_at: string | null;
  } | null;
  payments: Array<{
    id: string;
    status: string;
    amount_cents: number;
    paid_at: string | null;
    refunded_at: string | null;
  }>;
  payouts: Array<{
    id: string;
    status: string;
    net_amount_cents: number;
    held_at: string | null;
    hold_reason: string | null;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    category: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    actor_role: string;
    created_at: string;
  }>;
}

export interface AdminCustomer {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  hub_id: string | null;
  created_at: string;
  total_jobs: number;
  completed_jobs: number;
  total_spent_cents: number;
}

export interface AdminCustomerDetail {
  profile: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: string;
    city: string | null;
    state: string | null;
    hub_id: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    accepted_mechanic_id: string | null;
    completed_at: string | null;
  }>;
  payments: Array<{
    id: string;
    job_id: string;
    amount_cents: number;
    status: string;
    paid_at: string | null;
    refunded_at: string | null;
  }>;
  support_requests: Array<{
    id: string;
    category: string;
    message: string;
    status: string;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    job_id: string;
    category: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
  }>;
}

export interface AdminPayment {
  id: string;
  job_id: string;
  job_title: string;
  customer_id: string;
  customer_name: string;
  mechanic_id: string | null;
  mechanic_name: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

export interface AdminPayout {
  id: string;
  mechanic_id: string;
  mechanic_name: string;
  gross_amount_cents: number;
  net_amount_cents: number;
  commission_cents: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export interface AdminHub {
  id: string;
  name: string;
  slug: string;
  zip: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  active_radius_miles: number;
  max_radius_miles: number;
  invite_only: boolean;
  auto_expand_enabled: boolean;
  is_active: boolean;
  launch_date: string | null;
  created_at: string;
  active_mechanics: number;
  jobs_last_14d: number;
}

export interface HubHealth {
  hub_id: string;
  hub_name: string;
  period_days: number;
  jobs_requested: number;
  jobs_completed: number;
  completion_rate: number;
  active_mechanics: number;
  disputes: number;
  support_tickets: number;
  avg_response_minutes: number | null;
  avg_jobs_per_day: number;
  disputes_per_40_completed: number;
  tickets_per_job: number;
  health_score: number;
  can_expand: boolean;
  hub_config: {
    active_radius_miles: number;
    invite_only: boolean;
    auto_expand_enabled: boolean;
  };
}

export interface AdminMetrics {
  period_days: number;
  hub_id: string | null;
  daily_jobs_created: Array<{ date: string; count: number }>;
  daily_jobs_completed: Array<{ date: string; count: number }>;
  totals: {
    jobs_created: number;
    jobs_completed: number;
    quotes: number;
    accepted: number;
    disputes: number;
    refunds: number;
    support_tickets: number;
  };
  rates: {
    quotes_per_job: number;
    acceptance_rate: number;
    completion_rate: number;
    dispute_rate: number;
    refund_rate: number;
    tickets_per_job: number;
  };
  decline_reasons: Array<{ reason: string; count: number }>;
}

export interface WaitlistHeatmap {
  period_days: number;
  hub_id: string | null;
  total: number;
  by_zip: Array<{ zip: string; city: string | null; state: string | null; count: number; hub_id: string | null }>;
  by_hub: Array<{ hub_id: string | null; hub_name: string | null; count: number }>;
  by_user_type: Array<{ user_type: string; count: number }>;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// Jobs
// =====================================================

export async function adminGetJobs(
  status?: string,
  hubId?: string,
  limit = 50,
  offset = 0
): Promise<AdminJob[]> {
  const { data, error } = await supabase.rpc('admin_get_jobs', {
    p_status: status || null,
    p_hub_id: hubId || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

export async function adminGetJobDetail(jobId: string): Promise<AdminJobDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_job_detail', {
    p_job_id: jobId,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// =====================================================
// Mechanics
// =====================================================

export async function adminGetMechanics(
  status?: string,
  hubId?: string,
  limit = 50,
  offset = 0
): Promise<AdminMechanic[]> {
  const { data, error } = await supabase.rpc('admin_get_mechanics', {
    p_status: status || null,
    p_hub_id: hubId || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

export async function adminGetMechanicDetail(mechanicId: string): Promise<AdminMechanicDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_mechanic_detail', {
    p_mechanic_id: mechanicId,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

export async function adminSetVerificationStatus(
  mechanicId: string,
  status: string,
  rejectionReason?: string
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('set_mechanic_verification_status', {
    p_mechanic_id: mechanicId,
    p_status: status,
    p_rejection_reason: rejectionReason || null,
  });
  if (error) throw error;
  return data;
}

export async function adminSetMechanicTier(mechanicId: string, tier: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('set_mechanic_tier', {
    p_mechanic_id: mechanicId,
    p_tier: tier,
  });
  if (error) throw error;
  return data;
}

export async function adminAddStrike(
  mechanicId: string,
  reason: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; new_strikes: number }> {
  const { data, error } = await supabase.rpc('add_mechanic_strike', {
    p_mechanic_id: mechanicId,
    p_reason: reason,
    p_details: details || {},
  });
  if (error) throw error;
  return data;
}

// =====================================================
// Support Requests
// =====================================================

export async function adminListSupportRequests(
  status?: string,
  category?: string,
  limit = 50,
  offset = 0
): Promise<AdminSupportRequestEnriched[]> {
  const { data, error } = await supabase.rpc('admin_list_support_requests', {
    p_status: status || null,
    p_category: category || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

export async function adminGetSupportRequestDetails(
  supportRequestId: string
): Promise<AdminSupportRequestDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_support_request_details', {
    p_support_request_id: supportRequestId,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

export async function adminUpdateSupportRequestStatus(
  supportRequestId: string,
  status: string,
  internalNote?: string
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('admin_update_support_request_status', {
    p_support_request_id: supportRequestId,
    p_status: status,
    p_internal_note: internalNote || null,
  });
  if (error) throw error;
  return data;
}

// =====================================================
// Customers
// =====================================================

export async function adminListCustomers(
  limit = 50,
  offset = 0,
  query?: string
): Promise<AdminCustomer[]> {
  const { data, error } = await supabase.rpc('admin_list_customers', {
    p_limit: limit,
    p_offset: offset,
    p_query: query || null,
  });
  if (error) throw error;
  return data || [];
}

export async function adminGetCustomerDetails(
  customerId: string
): Promise<AdminCustomerDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_customer_details', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// =====================================================
// Payments & Payouts
// =====================================================

export async function adminGetPayments(
  status?: string,
  limit = 50,
  offset = 0
): Promise<AdminPayment[]> {
  const { data, error } = await supabase.rpc('admin_get_payments', {
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

export async function adminGetPayouts(
  status?: string,
  limit = 50,
  offset = 0
): Promise<AdminPayout[]> {
  const { data, error } = await supabase.rpc('admin_get_payouts', {
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

// =====================================================
// Hubs
// =====================================================

export async function adminGetHubs(): Promise<AdminHub[]> {
  const { data, error } = await supabase.rpc('admin_get_hubs');
  if (error) throw error;
  return data || [];
}

export async function adminGetHubHealth(hubId: string, days = 14): Promise<HubHealth | null> {
  const { data, error } = await supabase.rpc('admin_get_hub_health', {
    p_hub_id: hubId,
    p_days: days,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// =====================================================
// Metrics
// =====================================================

export async function adminGetMetrics(hubId?: string, days = 14): Promise<AdminMetrics | null> {
  const { data, error } = await supabase.rpc('admin_get_metrics', {
    p_hub_id: hubId || null,
    p_days: days,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// =====================================================
// Waitlist
// =====================================================

export async function adminGetWaitlistHeatmap(hubId?: string, days = 30): Promise<WaitlistHeatmap | null> {
  const { data, error } = await supabase.rpc('admin_get_waitlist_heatmap', {
    p_hub_id: hubId || null,
    p_days: days,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// =====================================================
// Audit Log
// =====================================================

export async function adminGetAuditLog(
  entityType?: string,
  entityId?: string,
  action?: string,
  limit = 100,
  offset = 0
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.rpc('admin_get_audit_log', {
    p_entity_type: entityType || null,
    p_entity_id: entityId || null,
    p_action: action || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

// =====================================================
// Helpers
// =====================================================

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}