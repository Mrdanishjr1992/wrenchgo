import { supabase } from './supabase';
import type {
  Profile,
  Job,
  Quote,
  Review,
  MechanicProfile,
  ServiceHub,
  Waitlist,
  Dispute,
  Payout,
  SupportRequest,
  Payment,
  Message,
  DatabaseSchema,
  TableName,
  TableColumn,
  DisputeStatus,
  PayoutStatus,
  SupportStatus,
  VerificationStatus,
} from '../types/database';

// =====================================================
// COMPILE-TIME SCHEMA VALIDATION
// =====================================================

type AssertColumns<T extends TableName, K extends readonly TableColumn<T>[]> = K;

const PROFILE_COLUMNS = [
  'id', 'full_name', 'email', 'phone', 'city', 'state', 'hub_id', 'role', 'deleted_at', 'created_at'
] as const satisfies readonly TableColumn<'profiles'>[];

const JOB_COLUMNS = [
  'id', 'title', 'description', 'status', 'symptom_key', 'customer_id', 'accepted_mechanic_id',
  'hub_id', 'location_lat', 'location_lng', 'location_address', 'preferred_time',
  'final_price_cents', 'created_at', 'scheduled_at', 'completed_at', 'cancelled_at', 'deleted_at'
] as const satisfies readonly TableColumn<'jobs'>[];

const DISPUTE_COLUMNS = [
  'id', 'job_id', 'contract_id', 'filed_by', 'filed_by_role', 'filed_against', 'status',
  'category', 'description', 'desired_resolution', 'evidence_urls', 'resolved_at', 'resolved_by',
  'resolution_type', 'resolution_notes', 'customer_refund_cents', 'mechanic_adjustment_cents',
  'internal_notes', 'assigned_to', 'priority', 'response_deadline', 'evidence_deadline',
  'created_at', 'updated_at'
] as const satisfies readonly TableColumn<'disputes'>[];

const PAYOUT_COLUMNS = [
  'id', 'contract_id', 'mechanic_id', 'gross_amount_cents', 'commission_cents',
  'adjustments_cents', 'net_amount_cents', 'status', 'stripe_transfer_id', 'stripe_payout_id',
  'scheduled_for', 'processed_at', 'failed_at', 'failure_reason', 'held_at', 'hold_reason',
  'released_at', 'created_at', 'updated_at'
] as const satisfies readonly TableColumn<'payouts'>[];

const SUPPORT_COLUMNS = [
  'id', 'user_id', 'job_id', 'category', 'message', 'screenshot_url', 'metadata', 'status',
  'created_at', 'updated_at'
] as const satisfies readonly TableColumn<'support_requests'>[];

const HUB_COLUMNS = [
  'id', 'name', 'slug', 'zip', 'lat', 'lng', 'active_radius_miles', 'max_radius_miles',
  'is_active', 'invite_only', 'auto_expand_enabled', 'launch_date', 'graduated_at', 'created_at'
] as const satisfies readonly TableColumn<'service_hubs'>[];

const WAITLIST_COLUMNS = [
  'id', 'email', 'phone', 'zip', 'lat', 'lng', 'nearest_hub_id', 'distance_miles', 'ring',
  'user_type', 'service_needed', 'services_offered', 'years_experience', 'willing_travel_miles',
  'invited_at', 'converted_at', 'created_at'
] as const satisfies readonly TableColumn<'waitlist'>[];

// =====================================================
// ADMIN TYPES (derived from Database types)
// =====================================================

export interface AdminCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  hub_id: string | null;
  created_at: string;
}

export interface AdminMechanic {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  hub_id: string | null;
  bio: string | null;
  years_experience: number | null;
  rating_avg: number | null;
  rating_count: number;
  jobs_completed: number;
  is_available: boolean;
  verification_status: VerificationStatus | null;
  created_at: string;
}

export interface AdminJob {
  id: string;
  title: string;
  status: string;
  customer_id: string;
  customer_name: string | null;
  mechanic_id: string | null;
  mechanic_name: string | null;
  hub_id: string | null;
  final_price_cents: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AdminDispute {
  id: string;
  job_id: string;
  job_title: string | null;
  filed_by: string;
  filed_by_role: string;
  filed_against: string;
  status: DisputeStatus;
  category: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminSupportThread {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  category: string;
  message: string;
  job_id: string | null;
  status: SupportStatus;
  created_at: string;
}

export interface AdminPaymentLineItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface AdminPayment {
  id: string;
  job_id: string;
  contract_id: string | null;
  customer_id: string;
  mechanic_id: string;
  customer_name: string | null;
  mechanic_name: string | null;
  // From payment record
  amount_cents: number;
  platform_fee_cents: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  // From contract (source of truth for breakdown)
  subtotal_cents: number;
  total_customer_cents: number;
  mechanic_commission_cents: number;
  mechanic_payout_cents: number;
}

export interface AdminPayout {
  id: string;
  job_id: string;
  contract_id: string;
  payment_id: string | null;
  mechanic_id: string;
  mechanic_name: string | null;
  // From payout record (source of truth)
  gross_amount_cents: number;
  commission_cents: number;
  net_amount_cents: number;
  // From contract for context
  subtotal_cents: number;
  platform_fee_cents: number;
  status: PayoutStatus;
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
  is_active: boolean;
  invite_only: boolean;
  created_at: string;
}

export interface AdminWaitlistItem {
  id: string;
  email: string;
  phone: string | null;
  zip: string;
  user_type: string | null;
  nearest_hub_id: string | null;
  distance_miles: number | null;
  ring: number | null;
  invited_at: string | null;
  converted_at: string | null;
  created_at: string;
}

export interface AdminVerificationItem {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  hub_id: string | null;
  verification_status: VerificationStatus | null;
  created_at: string;
}

export interface AdminMetrics {
  period_days: number;
  totals: {
    jobs_created: number;
    jobs_completed: number;
    quotes: number;
    accepted: number;
    disputes: number;
    support_tickets: number;
  };
  rates: {
    quotes_per_job: number;
    acceptance_rate: number;
    completion_rate: number;
    dispute_rate: number;
  };
}

// =====================================================
// Filter Types
// =====================================================

export interface AdminFilters {
  hubId?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// =====================================================
// CUSTOMERS
// =====================================================

export async function adminListCustomers(filters: AdminFilters = {}): Promise<AdminCustomer[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, city, state, hub_id, created_at')
    .eq('role', 'customer')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.hubId) {
    query = query.eq('hub_id', filters.hubId);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function adminGetCustomerDetail(customerId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, city, state, hub_id, created_at')
    .eq('id', customerId)
    .single();

  if (profileError) throw profileError;

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, created_at, completed_at, final_price_cents')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return { profile, jobs: jobs || [] };
}

// =====================================================
// MECHANICS
// =====================================================

export async function adminListMechanics(filters: AdminFilters = {}): Promise<AdminMechanic[]> {
  let query = supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, city, state, hub_id, created_at,
      mechanic_profiles(bio, years_experience, rating_avg, rating_count, jobs_completed, is_available, verification_status)
    `)
    .eq('role', 'mechanic')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.hubId) {
    query = query.eq('hub_id', filters.hubId);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((p: any) => {
    const mp = Array.isArray(p.mechanic_profiles) ? p.mechanic_profiles[0] : p.mechanic_profiles;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      state: p.state,
      hub_id: p.hub_id,
      bio: mp?.bio || null,
      years_experience: mp?.years_experience || null,
      rating_avg: mp?.rating_avg || null,
      rating_count: mp?.rating_count || 0,
      jobs_completed: mp?.jobs_completed || 0,
      is_available: mp?.is_available ?? true,
      verification_status: mp?.verification_status || null,
      created_at: p.created_at,
    };
  });
}

export async function adminGetMechanicDetail(mechanicId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, city, state, hub_id, created_at,
      mechanic_profiles(bio, years_experience, hourly_rate_cents, rating_avg, rating_count, jobs_completed, is_available, stripe_onboarding_complete, verification_status)
    `)
    .eq('id', mechanicId)
    .single();

  if (profileError) throw profileError;

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, created_at, completed_at, final_price_cents')
    .eq('accepted_mechanic_id', mechanicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, overall_rating, comment, created_at')
    .eq('reviewee_id', mechanicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  return { profile, jobs: jobs || [], reviews: reviews || [] };
}

// =====================================================
// JOBS
// =====================================================

export async function adminListJobs(filters: AdminFilters = {}): Promise<AdminJob[]> {
  let query = supabase
    .from('jobs')
    .select('id, title, status, customer_id, accepted_mechanic_id, hub_id, final_price_cents, created_at, completed_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.hubId) {
    query = query.eq('hub_id', filters.hubId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch customer/mechanic names separately
  const jobs = data || [];
  const customerIds = [...new Set(jobs.map(j => j.customer_id).filter(Boolean))];
  const mechanicIds = [...new Set(jobs.map(j => j.accepted_mechanic_id).filter(Boolean))];
  const allIds = [...new Set([...customerIds, ...mechanicIds])];

  let namesMap: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', allIds);
    (profiles || []).forEach((p: any) => {
      namesMap[p.id] = p.full_name || 'Unknown';
    });
  }

  return jobs.map(j => ({
    id: j.id,
    title: j.title,
    status: j.status,
    customer_id: j.customer_id,
    customer_name: namesMap[j.customer_id] || null,
    mechanic_id: j.accepted_mechanic_id,
    mechanic_name: j.accepted_mechanic_id ? namesMap[j.accepted_mechanic_id] || null : null,
    hub_id: j.hub_id,
    final_price_cents: j.final_price_cents,
    created_at: j.created_at,
    completed_at: j.completed_at,
  }));
}

export async function adminGetJobDetail(jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, title, description, status, symptom_key, customer_id,
      accepted_mechanic_id, hub_id, location_lat, location_lng,
      location_address, preferred_time, final_price_cents,
      created_at, scheduled_at, completed_at, cancelled_at
    `)
    .eq('id', jobId)
    .single();

  if (jobError) throw jobError;

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, mechanic_id, price_cents, estimated_hours, notes, status, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  const { data: disputes } = await supabase
    .from('disputes')
    .select('id, status, category, priority, created_at, resolved_at')
    .eq('job_id', jobId);

  const { data: supportRequests } = await supabase
    .from('support_requests')
    .select('id, status, category, message, created_at')
    .eq('job_id', jobId);

  const { data: payments } = await supabase
    .from('payments')
    .select('id, status, amount_cents, platform_fee_cents, created_at, paid_at')
    .eq('job_id', jobId);

  let customer = null;
  if (job.customer_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('id', job.customer_id)
      .single();
    customer = data;
  }

  let mechanic = null;
  if (job.accepted_mechanic_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('id', job.accepted_mechanic_id)
      .single();
    mechanic = data;
  }

  let evidence = null;
  try {
    const { data: evidenceData, error: evidenceError } = await supabase.rpc('admin_get_job_evidence', {
      p_job_id: jobId,
    });
    if (!evidenceError && evidenceData) {
      evidence = evidenceData;
    }
  } catch (e) {
    console.error('Failed to fetch job evidence:', e);
  }

  let contract = null;
  let lineItems: any[] = [];
  let payout = null;

  try {
    const { data: contractData } = await supabase
      .from('job_contracts')
      .select(`
        id, status, quoted_price_cents, platform_fee_cents, estimated_hours,
        subtotal_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents,
        payment_authorized_at, payment_captured_at, created_at
      `)
      .eq('job_id', jobId)
      .single();

    if (contractData) {
      contract = contractData;

      const { data: itemsData } = await supabase
        .from('invoice_line_items')
        .select('id, item_type, description, quantity, unit_price_cents, total_cents, part_number, part_source, approval_status, notes, created_at')
        .eq('contract_id', contractData.id)
        .order('sort_order', { ascending: true });
      lineItems = itemsData || [];

      // Fetch payout for this contract
      const { data: payoutData } = await supabase
        .from('payouts')
        .select('id, status, gross_amount_cents, commission_cents, net_amount_cents, created_at, processed_at')
        .eq('contract_id', contractData.id)
        .single();
      payout = payoutData;
    }
  } catch (e) {
    console.error('Failed to fetch contract/line items:', e);
  }

  let messages: any[] = [];
  try {
    const { data: messagesData, error: messagesError } = await supabase.rpc('admin_list_job_messages', {
      p_job_id: jobId,
      p_limit: 100,
    });
    if (!messagesError && messagesData) {
      messages = messagesData;
    }
  } catch (e) {
    console.error('Failed to fetch job messages:', e);
  }

  const acceptedQuote = (quotes || []).find((q: any) => q.status === 'accepted');

  // Calculate labor/parts from line items
  let laborCents = 0;
  let partsCents = 0;
  lineItems.forEach((item: any) => {
    if (item.approval_status === 'approved') {
      if (isLaborType(item.item_type)) {
        laborCents += item.total_cents;
      } else if (isPartsType(item.item_type)) {
        partsCents += item.total_cents;
      }
    }
  });

  return {
    job,
    quotes: quotes || [],
    disputes: disputes || [],
    supportRequests: supportRequests || [],
    payments: payments || [],
    customer,
    mechanic,
    evidence,
    acceptedQuote: acceptedQuote || null,
    contract,
    lineItems,
    messages,
    payout,
    financials: {
      laborCents,
      partsCents,
      subtotalCents: contract?.subtotal_cents || (laborCents + partsCents),
      platformFeeCents: contract?.platform_fee_cents || 1500,
      totalCustomerCents: contract?.total_customer_cents || 0,
      commissionCents: contract?.mechanic_commission_cents || 0,
      mechanicPayoutCents: contract?.mechanic_payout_cents || 0,
    },
  };
}

// =====================================================
// DISPUTES
// =====================================================

export async function adminListDisputes(filters: AdminFilters = {}): Promise<AdminDispute[]> {
  let query = supabase
    .from('disputes')
    .select('id, job_id, filed_by, filed_by_role, filed_against, status, category, priority, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch job titles
  const disputes = data || [];
  const jobIds = [...new Set(disputes.map(d => d.job_id).filter(Boolean))];
  let jobsMap: Record<string, string> = {};

  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);
    (jobs || []).forEach((j: any) => {
      jobsMap[j.id] = j.title;
    });
  }

  return disputes.map(d => ({
    id: d.id,
    job_id: d.job_id,
    job_title: jobsMap[d.job_id] || null,
    filed_by: d.filed_by,
    filed_by_role: d.filed_by_role,
    filed_against: d.filed_against,
    status: d.status,
    category: d.category,
    priority: d.priority,
    created_at: d.created_at,
    resolved_at: d.resolved_at,
  }));
}

export async function adminGetDisputeDetail(disputeId: string) {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (error) throw error;

  let job = null;
  if (dispute.job_id) {
    const { data } = await supabase
      .from('jobs')
      .select('id, title, status, customer_id, accepted_mechanic_id')
      .eq('id', dispute.job_id)
      .single();
    job = data;
  }

  return { dispute, job };
}

// =====================================================
// SUPPORT
// =====================================================

export async function adminListSupportThreads(filters: AdminFilters = {}): Promise<AdminSupportThread[]> {
  let query = supabase
    .from('support_requests')
    .select('id, user_id, category, message, job_id, status, created_at')
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch user names
  const threads = data || [];
  const userIds = [...new Set(threads.map(t => t.user_id).filter(Boolean))];
  let usersMap: Record<string, { full_name: string; email: string }> = {};

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    (users || []).forEach((u: any) => {
      usersMap[u.id] = { full_name: u.full_name, email: u.email };
    });
  }

  return threads.map(t => ({
    id: t.id,
    user_id: t.user_id,
    user_name: t.user_id ? usersMap[t.user_id]?.full_name || null : null,
    user_email: t.user_id ? usersMap[t.user_id]?.email || null : null,
    category: t.category,
    message: t.message,
    job_id: t.job_id,
    status: t.status,
    created_at: t.created_at,
  }));
}

export async function adminGetSupportDetail(supportId: string) {
  const { data: request, error } = await supabase
    .from('support_requests')
    .select('*')
    .eq('id', supportId)
    .single();

  if (error) throw error;

  let user = null;
  if (request.user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role')
      .eq('id', request.user_id)
      .single();
    user = data;
  }

  let job = null;
  if (request.job_id) {
    const { data } = await supabase
      .from('jobs')
      .select('id, title, status')
      .eq('id', request.job_id)
      .single();
    job = data;
  }

  return { request, user, job };
}

export async function adminUpdateSupportStatus(supportId: string, status: string) {
  const { error } = await supabase
    .from('support_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', supportId);

  if (error) throw error;
  return { success: true };
}

// =====================================================
// PAYMENTS - Use contract as source of truth for financials
// =====================================================
function isLaborType(itemType: string): boolean {
  return itemType === 'base_labor' || itemType === 'additional_labor';
}

function isPartsType(itemType: string): boolean {
  return itemType === 'parts';
}

export async function adminListPayments(filters: AdminFilters = {}): Promise<AdminPayment[]> {
  let query = supabase
    .from('payments')
    .select('id, job_id, customer_id, mechanic_id, amount_cents, platform_fee_cents, status, created_at, paid_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const payments = data || [];
  if (payments.length === 0) return [];

  const jobIds = [...new Set(payments.map(p => p.job_id))];
  const userIds = [...new Set([...payments.map(p => p.customer_id), ...payments.map(p => p.mechanic_id)])];

  // Fetch names
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
  const namesMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || 'Unknown']));

  // Get contracts - SOURCE OF TRUTH for all financial breakdown
  const { data: contracts } = await supabase
    .from('job_contracts')
    .select('id, job_id, subtotal_cents, platform_fee_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents')
    .in('job_id', jobIds);

  const jobToContract = new Map((contracts || []).map(c => [c.job_id, c]));
  const contractIds = (contracts || []).map(c => c.id);

  // Get line items to calculate labor/parts
  const { data: lineItems } = contractIds.length > 0 ? await supabase
    .from('invoice_line_items')
    .select('contract_id, item_type, total_cents')
    .in('contract_id', contractIds)
    .eq('approval_status', 'approved') : { data: [] };

  const contractToLabor = new Map<string, number>();
  const contractToParts = new Map<string, number>();
  (lineItems || []).forEach((item: any) => {
    if (isLaborType(item.item_type)) {
      contractToLabor.set(item.contract_id, (contractToLabor.get(item.contract_id) || 0) + item.total_cents);
    } else if (isPartsType(item.item_type)) {
      contractToParts.set(item.contract_id, (contractToParts.get(item.contract_id) || 0) + item.total_cents);
    }
  });

  return payments.map(p => {
    const c = jobToContract.get(p.job_id);
    const contractId = c?.id ?? null;
    const laborCents = contractId ? (contractToLabor.get(contractId) ?? 0) : 0;
    const partsCents = contractId ? (contractToParts.get(contractId) ?? 0) : 0;

    // Use contract values, fallback to payment record values, then 0
    const subtotalCents = c?.subtotal_cents ?? 0;
    const platformFeeCents = c?.platform_fee_cents ?? p.platform_fee_cents ?? 0;
    const totalCustomerCents = c?.total_customer_cents ?? p.amount_cents ?? 0;
    const commissionCents = c?.mechanic_commission_cents ?? 0;
    const payoutCents = c?.mechanic_payout_cents ?? 0;

    return {
      id: p.id,
      job_id: p.job_id,
      contract_id: c?.id ?? null,
      customer_id: p.customer_id,
      mechanic_id: p.mechanic_id,
      customer_name: namesMap.get(p.customer_id) ?? null,
      mechanic_name: namesMap.get(p.mechanic_id) ?? null,
      amount_cents: p.amount_cents ?? 0,
      platform_fee_cents: platformFeeCents,
      status: p.status,
      created_at: p.created_at,
      paid_at: p.paid_at,
      labor_cents: laborCents,
      parts_cents: partsCents,
      subtotal_cents: subtotalCents,
      total_customer_cents: totalCustomerCents,
      mechanic_commission_cents: commissionCents,
      mechanic_payout_cents: payoutCents,
    };
  });
}

// =====================================================
// PAYOUTS - Use payout record as source of truth
// =====================================================

export async function adminListPayouts(filters: AdminFilters = {}): Promise<AdminPayout[]> {
  let query = supabase
    .from('payouts')
    .select('id, contract_id, mechanic_id, gross_amount_cents, commission_cents, net_amount_cents, status, created_at, processed_at')
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const payouts = data || [];
  if (payouts.length === 0) return [];

  const contractIds = [...new Set(payouts.map(p => p.contract_id).filter(Boolean))];

  // Get contracts for job_id and financial context
  const { data: contracts } = await supabase
    .from('job_contracts')
    .select('id, job_id, subtotal_cents, platform_fee_cents')
    .in('id', contractIds);

  const contractMap = new Map((contracts || []).map(c => [c.id, c]));

  // Get line items to calculate labor
  const { data: lineItems } = contractIds.length > 0 ? await supabase
    .from('invoice_line_items')
    .select('contract_id, item_type, total_cents')
    .in('contract_id', contractIds)
    .eq('approval_status', 'approved') : { data: [] };

  const contractToLabor = new Map<string, number>();
  (lineItems || []).forEach((item: any) => {
    if (isLaborType(item.item_type)) {
      contractToLabor.set(item.contract_id, (contractToLabor.get(item.contract_id) || 0) + item.total_cents);
    }
  });

  // Get payments for linking
  const jobIds = [...new Set((contracts || []).map(c => c.job_id))];
  const { data: payments } = jobIds.length > 0 ? await supabase
    .from('payments')
    .select('id, job_id')
    .in('job_id', jobIds)
    .is('deleted_at', null) : { data: [] };
  const jobToPayment = new Map((payments || []).map((p: any) => [p.job_id, p.id]));

  // Get mechanic names
  const mechanicIds = [...new Set(payouts.map(p => p.mechanic_id).filter(Boolean))];
  const { data: profiles } = mechanicIds.length > 0 ? await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', mechanicIds) : { data: [] };
  const namesMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || 'Unknown']));

  return payouts.map(p => {
    const contract = contractMap.get(p.contract_id);
    const jobId = contract?.job_id ?? '';

    // Use payout record values with null safety
    const grossCents = p.gross_amount_cents ?? 0;
    const commissionCents = p.commission_cents ?? 0;
    const netCents = p.net_amount_cents ?? 0;

    return {
      id: p.id,
      job_id: jobId,
      contract_id: p.contract_id,
      payment_id: jobToPayment.get(jobId) ?? null,
      mechanic_id: p.mechanic_id,
      mechanic_name: namesMap.get(p.mechanic_id) ?? null,
      labor_cents: contractToLabor.get(p.contract_id) ?? 0,
      gross_amount_cents: grossCents,
      commission_cents: commissionCents,
      net_amount_cents: netCents,
      subtotal_cents: contract?.subtotal_cents ?? grossCents,
      platform_fee_cents: contract?.platform_fee_cents ?? 0,
      status: p.status,
      created_at: p.created_at,
      processed_at: p.processed_at,
    };
  });
}

// =====================================================
// HUBS
// =====================================================

export async function adminListHubs(filters: AdminFilters = {}): Promise<AdminHub[]> {
  let query = supabase
    .from('service_hubs')
    .select('id, name, slug, zip, lat, lng, active_radius_miles, max_radius_miles, is_active, invite_only, created_at')
    .order('name', { ascending: true })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,zip.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(h => ({
    ...h,
    city: null,
    state: null,
  }));
}

export async function adminGetHubDetail(hubId: string) {
  const { data: hub, error } = await supabase
    .from('service_hubs')
    .select('*')
    .eq('id', hubId)
    .single();

  if (error) throw error;

  // Count mechanics in hub
  const { count: mechanicCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .eq('role', 'mechanic')
    .is('deleted_at', null);

  // Count customers in hub
  const { count: customerCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .eq('role', 'customer')
    .is('deleted_at', null);

  // Count jobs in hub
  const { count: jobCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .is('deleted_at', null);

  return {
    hub,
    stats: {
      mechanics: mechanicCount || 0,
      customers: customerCount || 0,
      jobs: jobCount || 0,
    },
  };
}

export async function adminUpdateHub(
  hubId: string,
  updates: {
    is_active?: boolean;
    active_radius_miles?: number;
    max_radius_miles?: number;
    invite_only?: boolean;
    auto_expand_enabled?: boolean;
  }
) {
  const { data, error } = await supabase
    .from('service_hubs')
    .update(updates)
    .eq('id', hubId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Hub not found');
  }
  return data[0];
}

export interface CreateHubInput {
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  zip: string;
  active_radius_miles: number;
  max_radius_miles: number;
  notes?: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function adminCreateHub(input: CreateHubInput) {
  if (input.max_radius_miles < input.active_radius_miles) {
    throw new Error('Max radius must be greater than or equal to active radius');
  }
  if (input.active_radius_miles <= 0 || input.max_radius_miles <= 0) {
    throw new Error('Radius values must be positive');
  }
  if (input.max_radius_miles > 100) {
    throw new Error('Max radius cannot exceed 100 miles');
  }
  if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) {
    throw new Error('Invalid coordinates');
  }

  const slug = generateSlug(input.name);

  const { data, error } = await supabase
    .from('service_hubs')
    .insert({
      name: input.name,
      slug,
      zip: input.zip,
      lat: input.lat,
      lng: input.lng,
      active_radius_miles: input.active_radius_miles,
      max_radius_miles: input.max_radius_miles,
      is_active: false,
      invite_only: true,
      auto_expand_enabled: false,
      settings: {
        city: input.city,
        state: input.state,
        country: input.country,
        notes: input.notes || null,
      },
    })
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Failed to create hub');
  }
  return data[0];
}

export interface HubRecommendation {
  city: string;
  state: string;
  country: string;
  customer_count: number;
  mechanic_count: number;
  total_count: number;
  avg_lat: number;
  avg_lng: number;
  avg_distance_to_hub: number | null;
  demand_score: number;
  supply_score: number;
  readiness_score: number;
  suggested_radius: number;
}

export async function adminGetHubRecommendations(): Promise<HubRecommendation[]> {
  const { data, error } = await supabase.rpc('get_hub_recommendations');

  if (error) {
    console.error('RPC error, falling back to client-side aggregation:', error);
    return adminGetHubRecommendationsFallback();
  }

  return data || [];
}

async function adminGetHubRecommendationsFallback(): Promise<HubRecommendation[]> {
  const { data: waitlistData, error } = await supabase
    .from('waitlist')
    .select('zip, lat, lng, user_type, distance_miles, nearest_hub_id')
    .is('converted_at', null)
    .is('invited_at', null);

  if (error) throw error;
  if (!waitlistData || waitlistData.length === 0) return [];

  const zipGroups = new Map<string, {
    entries: typeof waitlistData;
    customers: number;
    mechanics: number;
  }>();

  for (const entry of waitlistData) {
    const zip = entry.zip?.substring(0, 3) || 'unknown';
    if (!zipGroups.has(zip)) {
      zipGroups.set(zip, { entries: [], customers: 0, mechanics: 0 });
    }
    const group = zipGroups.get(zip)!;
    group.entries.push(entry);
    if (entry.user_type === 'customer') group.customers++;
    if (entry.user_type === 'mechanic') group.mechanics++;
  }

  const recommendations: HubRecommendation[] = [];

  for (const [zip, group] of zipGroups) {
    if (group.entries.length < 5) continue;

    const validCoords = group.entries.filter(e => e.lat && e.lng);
    if (validCoords.length === 0) continue;

    const avgLat = validCoords.reduce((sum, e) => sum + (e.lat || 0), 0) / validCoords.length;
    const avgLng = validCoords.reduce((sum, e) => sum + (e.lng || 0), 0) / validCoords.length;
    const avgDistance = group.entries
      .filter(e => e.distance_miles != null)
      .reduce((sum, e, _, arr) => sum + (e.distance_miles || 0) / arr.length, 0) || null;

    const demandScore = Math.min(100, group.customers * 10);
    const supplyScore = Math.min(100, group.mechanics * 20);
    const readinessScore = Math.round((demandScore * 0.6 + supplyScore * 0.4));

    recommendations.push({
      city: `ZIP ${zip}xxx`,
      state: '',
      country: 'US',
      customer_count: group.customers,
      mechanic_count: group.mechanics,
      total_count: group.entries.length,
      avg_lat: avgLat,
      avg_lng: avgLng,
      avg_distance_to_hub: avgDistance,
      demand_score: demandScore,
      supply_score: supplyScore,
      readiness_score: readinessScore,
      suggested_radius: 15,
    });
  }

  return recommendations
    .sort((a, b) => b.readiness_score - a.readiness_score)
    .slice(0, 10);
}

// =====================================================
// WAITLIST
// =====================================================

export async function adminListWaitlist(filters: AdminFilters = {}): Promise<AdminWaitlistItem[]> {
  let query = supabase
    .from('waitlist')
    .select('id, email, phone, zip, user_type, nearest_hub_id, distance_miles, ring, invited_at, converted_at, created_at')
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.hubId) {
    query = query.eq('nearest_hub_id', filters.hubId);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`email.ilike.%${filters.search}%,zip.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// =====================================================
// VERIFICATION QUEUE
// =====================================================

export async function adminListVerificationQueue(filters: AdminFilters = {}): Promise<AdminVerificationItem[]> {
  let query = supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, hub_id, created_at,
      mechanic_profiles(verification_status)
    `)
    .eq('role', 'mechanic')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.hubId) {
    query = query.eq('hub_id', filters.hubId);
  }
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters.status) {
    query = query.eq('mechanic_profiles.verification_status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(p => {
    const mp = Array.isArray(p.mechanic_profiles) ? p.mechanic_profiles[0] : p.mechanic_profiles;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      hub_id: p.hub_id,
      verification_status: mp?.verification_status || 'pending_verification',
      created_at: p.created_at,
    };
  });
}

// =====================================================
// METRICS
// =====================================================

export async function adminGetMetrics(hubId?: string, days = 14): Promise<AdminMetrics> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  const dateFromStr = dateFrom.toISOString();

  // Jobs query
  let jobsQuery = supabase
    .from('jobs')
    .select('id, status')
    .gte('created_at', dateFromStr)
    .is('deleted_at', null);
  if (hubId) jobsQuery = jobsQuery.eq('hub_id', hubId);
  const { data: jobs } = await jobsQuery;

  // Quotes query
  let quotesQuery = supabase
    .from('quotes')
    .select('id, status')
    .gte('created_at', dateFromStr);
  const { data: quotes } = await quotesQuery;

  // Disputes query
  let disputesQuery = supabase
    .from('disputes')
    .select('id')
    .gte('created_at', dateFromStr);
  const { data: disputes } = await disputesQuery;

  // Support query
  let supportQuery = supabase
    .from('support_requests')
    .select('id')
    .gte('created_at', dateFromStr);
  const { data: support } = await supportQuery;

  const jobsArr = jobs || [];
  const quotesArr = quotes || [];
  const disputesArr = disputes || [];
  const supportArr = support || [];

  const jobsCreated = jobsArr.length;
  const jobsCompleted = jobsArr.filter(j => j.status === 'completed').length;
  const totalQuotes = quotesArr.length;
  const acceptedQuotes = quotesArr.filter(q => q.status === 'accepted').length;

  return {
    period_days: days,
    totals: {
      jobs_created: jobsCreated,
      jobs_completed: jobsCompleted,
      quotes: totalQuotes,
      accepted: acceptedQuotes,
      disputes: disputesArr.length,
      support_tickets: supportArr.length,
    },
    rates: {
      quotes_per_job: jobsCreated > 0 ? Math.round((totalQuotes / jobsCreated) * 10) / 10 : 0,
      acceptance_rate: totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0,
      completion_rate: jobsCreated > 0 ? Math.round((jobsCompleted / jobsCreated) * 100) : 0,
      dispute_rate: jobsCompleted > 0 ? Math.round((disputesArr.length / jobsCompleted) * 100) : 0,
    },
  };
}

// =====================================================
// DISPUTE ADMIN ACTIONS
// =====================================================

export async function adminUpdateDisputeStatus(
  disputeId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('disputes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', disputeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminAssignDispute(
  disputeId: string,
  assignedTo: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('disputes')
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .eq('id', disputeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminUpdateDisputePriority(
  disputeId: string,
  priority: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('disputes')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', disputeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminAddDisputeNote(
  disputeId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const { data: existing, error: fetchError } = await supabase
    .from('disputes')
    .select('internal_notes')
    .eq('id', disputeId)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };

  const existingNotes = existing?.internal_notes || '';
  const timestamp = new Date().toISOString();
  const newNote = `[${timestamp}] ${note}`;
  const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;

  const { error } = await supabase
    .from('disputes')
    .update({ internal_notes: updatedNotes, updated_at: new Date().toISOString() })
    .eq('id', disputeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminResolveDispute(
  disputeId: string,
  status: DisputeStatus,
  resolutionType?: string | null,
  resolutionNotes?: string | null,
  customerRefundCents?: number | null
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("admin_resolve_dispute", {
    p_dispute_id: disputeId,
    p_status: status,
    p_resolution_type: resolutionType ?? null,
    p_resolution_notes: resolutionNotes ?? null,
    p_customer_refund_cents: customerRefundCents ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: String(data.error) };
  }

  return { success: true };
}

// =====================================================
// PAYOUT ADMIN ACTIONS
// =====================================================

export async function adminHoldPayout(
  payoutId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('payouts')
    .update({
      status: 'held',
      held_at: new Date().toISOString(),
      hold_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminReleasePayout(
  payoutId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('payouts')
    .update({
      status: 'pending',
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminGetPayoutDetail(payoutId: string) {
  const { data: payout, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('id', payoutId)
    .single();

  if (error) throw error;

  let mechanic = null;
  if (payout.mechanic_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', payout.mechanic_id)
      .single();
    mechanic = data;
  }

  return { payout, mechanic };
}

// =====================================================
// HUB READINESS / EXPANSION METRICS
// =====================================================

export interface HubReadinessMetrics {
  hub_id: string;
  hub_name: string;
  is_active: boolean;
  active_mechanics: number;
  verified_mechanics: number;
  total_customers: number;
  jobs_last_7_days: number;
  jobs_last_30_days: number;
  completed_jobs_30_days: number;
  disputes_30_days: number;
  cancellations_30_days: number;
  waitlist_count: number;
  avg_quotes_per_job: number;
  completion_rate: number;
  dispute_rate: number;
  readiness_score: number;
}

export async function adminGetHubReadiness(hubId: string): Promise<HubReadinessMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get hub info
  const { data: hub } = await supabase
    .from('service_hubs')
    .select('id, name, is_active')
    .eq('id', hubId)
    .single();

  // Active mechanics count
  const { count: activeMechanics } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .eq('role', 'mechanic')
    .is('deleted_at', null);

  // Verified mechanics count
  const { data: verifiedData } = await supabase
    .from('profiles')
    .select('id, mechanic_profiles(verification_status)')
    .eq('hub_id', hubId)
    .eq('role', 'mechanic')
    .is('deleted_at', null);

  const verifiedMechanics = (verifiedData || []).filter(m => {
    const mp = Array.isArray(m.mechanic_profiles) ? m.mechanic_profiles[0] : m.mechanic_profiles;
    return mp?.verification_status === 'active';
  }).length;

  // Customer count
  const { count: customerCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .eq('role', 'customer')
    .is('deleted_at', null);

  // Jobs last 7 days
  const { count: jobs7Days } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hubId)
    .gte('created_at', sevenDaysAgo)
    .is('deleted_at', null);

  // Jobs last 30 days
  const { data: jobs30DaysData } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('hub_id', hubId)
    .gte('created_at', thirtyDaysAgo)
    .is('deleted_at', null);

  const jobs30Days = jobs30DaysData?.length || 0;
  const completedJobs30Days = jobs30DaysData?.filter(j => j.status === 'completed').length || 0;
  const cancelledJobs30Days = jobs30DaysData?.filter(j => j.status === 'cancelled').length || 0;

  // Get hub job IDs for scoping disputes/quotes
  const hubJobIds = (jobs30DaysData || []).map(j => j.id);

  // Disputes last 30 days (hub-scoped via job_id)
  let disputes30Days = 0;
  if (hubJobIds.length > 0) {
    const { count } = await supabase
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .in('job_id', hubJobIds)
      .gte('created_at', thirtyDaysAgo);
    disputes30Days = count || 0;
  }

  // Waitlist count for this hub
  const { count: waitlistCount } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('nearest_hub_id', hubId)
    .is('converted_at', null);

  // Quotes for avg calculation (hub-scoped via job_id)
  let quotesCount = 0;
  if (hubJobIds.length > 0) {
    const { count } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('job_id', hubJobIds)
      .gte('created_at', thirtyDaysAgo);
    quotesCount = count || 0;
  }

  const avgQuotesPerJob = jobs30Days > 0 ? Math.round((quotesCount / jobs30Days) * 10) / 10 : 0;
  const completionRate = jobs30Days > 0 ? Math.round((completedJobs30Days / jobs30Days) * 100) : 0;
  const disputeRate = completedJobs30Days > 0 ? Math.round((disputes30Days / completedJobs30Days) * 100) : 0;

  // Calculate readiness score (0-100)
  let readinessScore = 0;
  if ((activeMechanics || 0) >= 3) readinessScore += 20;
  else if ((activeMechanics || 0) >= 1) readinessScore += 10;
  if (verifiedMechanics >= 2) readinessScore += 20;
  else if (verifiedMechanics >= 1) readinessScore += 10;
  if ((jobs7Days || 0) >= 5) readinessScore += 20;
  else if ((jobs7Days || 0) >= 1) readinessScore += 10;
  if (completionRate >= 80) readinessScore += 20;
  else if (completionRate >= 50) readinessScore += 10;
  if (disputeRate <= 5) readinessScore += 20;
  else if (disputeRate <= 15) readinessScore += 10;

  return {
    hub_id: hubId,
    hub_name: hub?.name || 'Unknown',
    is_active: hub?.is_active || false,
    active_mechanics: activeMechanics || 0,
    verified_mechanics: verifiedMechanics,
    total_customers: customerCount || 0,
    jobs_last_7_days: jobs7Days || 0,
    jobs_last_30_days: jobs30Days,
    completed_jobs_30_days: completedJobs30Days,
    disputes_30_days: disputes30Days || 0,
    cancellations_30_days: cancelledJobs30Days,
    waitlist_count: waitlistCount || 0,
    avg_quotes_per_job: avgQuotesPerJob,
    completion_rate: completionRate,
    dispute_rate: disputeRate,
    readiness_score: readinessScore,
  };
}

// =====================================================
// ADMIN MESSAGING
// =====================================================

export async function adminSendMessage(
  recipientId: string,
  jobId: string,
  body: string,
  senderId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('messages')
    .insert({
      job_id: jobId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
    });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// =====================================================
// HELPERS
// =====================================================

export function formatCents(cents: number | null | undefined): string {
  const value = Number(cents);
  if (cents === null || cents === undefined || !Number.isFinite(value)) {
    return '$0.00';
  }
  return `$${(value / 100).toFixed(2)}`;
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}





