import { supabase } from './supabase';
import { 
  DisputeStatus, 
  DisputeCategory, 
  DisputeResolutionType,
  DisputePriority,
  DISPUTE_STATUS,
  DISPUTE_DEFAULTS 
} from '../constants/disputes';

export interface Dispute {
  id: string;
  job_id: string;
  contract_id: string | null;
  filed_by: string;
  filed_by_role: 'customer' | 'mechanic';
  filed_by_name?: string;
  filed_against: string;
  filed_against_name?: string;
  status: DisputeStatus;
  category: DisputeCategory;
  description: string;
  desired_resolution: string | null;
  mechanic_response: string | null;
  mechanic_responded_at: string | null;
  evidence_urls: string[] | null;
  resolution_type: DisputeResolutionType | null;
  resolution_notes: string | null;
  customer_refund_cents: number | null;
  mechanic_adjustment_cents: number | null;
  priority: DisputePriority;
  response_deadline: string | null;
  sla_breached: boolean;
  escalated_at: string | null;
  created_at: string;
  resolved_at: string | null;
  job_title?: string;
  job_status?: string;
}

export interface ComebackEligibility {
  can_file: boolean;
  reason?: string;
  window_days?: number;
  days_remaining?: number;
  days_since?: number;
  contract_id?: string;
  mechanic_id?: string;
  dispute_id?: string;
}

export interface DisputeDetail {
  dispute: Dispute;
  job: any;
  contract: any;
  customer: { id: string; full_name: string; avatar_url: string | null };
  mechanic: { id: string; full_name: string; avatar_url: string | null };
  events: any[];
  messages: any[];
}

// Check if customer can file a comeback
export async function canFileComeback(jobId: string): Promise<ComebackEligibility> {
  const { data, error } = await supabase.rpc('can_file_comeback', { p_job_id: jobId });
  if (error) throw error;
  return data as ComebackEligibility;
}

// Customer files a comeback
export async function customerFileComeback(
  jobId: string,
  description: string,
  desiredResolution?: string,
  evidenceUrls?: string[]
): Promise<{ success: boolean; dispute_id?: string; error?: string; response_deadline?: string }> {
  const { data, error } = await supabase.rpc('customer_file_comeback', {
    p_job_id: jobId,
    p_description: description,
    p_desired_resolution: desiredResolution || null,
    p_evidence_urls: evidenceUrls || null,
  });
  if (error) throw error;
  return data;
}

// Mechanic responds to dispute
export async function mechanicRespondToDispute(
  disputeId: string,
  response: string
): Promise<{ success: boolean; error?: string; sla_breached?: boolean }> {
  const { data, error } = await supabase.rpc('mechanic_respond_to_dispute', {
    p_dispute_id: disputeId,
    p_response: response,
  });
  if (error) throw error;
  return data;
}

// Admin resolve dispute
export async function adminResolveDispute(
  disputeId: string,
  resolutionType: DisputeResolutionType,
  resolutionNotes: string,
  customerRefundCents: number = 0,
  mechanicAdjustmentCents: number = 0
): Promise<{ success: boolean; error?: string; status?: DisputeStatus }> {
  const { data, error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: disputeId,
    p_resolution_type: resolutionType,
    p_resolution_notes: resolutionNotes,
    p_customer_refund_cents: customerRefundCents,
    p_mechanic_adjustment_cents: mechanicAdjustmentCents,
  });
  if (error) throw error;
  return data;
}

// Admin get disputes list
export async function adminGetDisputes(
  status?: string,
  priority?: string,
  limit: number = 50,
  offset: number = 0
): Promise<Dispute[]> {
  const { data, error } = await supabase.rpc('admin_get_disputes', {
    p_status: status || null,
    p_priority: priority || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

// Admin get single dispute detail
export async function adminGetDisputeDetail(disputeId: string): Promise<DisputeDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_dispute_detail', {
    p_dispute_id: disputeId,
  });
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

// Get disputes for current user (customer or mechanic)
export async function getMyDisputes(): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select(`
      *,
      jobs:job_id (title, status)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    job_title: d.jobs?.title,
    job_status: d.jobs?.status,
  }));
}

// Get dispute by job ID
export async function getDisputeForJob(jobId: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('job_id', jobId)
    .in('status', [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.EVIDENCE_REQUESTED])
    .maybeSingle();
  
  if (error) throw error;
  return data;
}

// Send message with enforcement
export async function sendMessageEnforced(
  jobId: string,
  body: string
): Promise<{ success: boolean; message_id?: string; error?: string; reason?: string }> {
  const { data, error } = await supabase.rpc('send_message_enforced', {
    p_job_id: jobId,
    p_body: body,
  });
  if (error) throw error;
  return data;
}

// Get chat lifecycle status for a job
export async function getChatLifecycle(jobId: string): Promise<{
  is_open: boolean;
  is_readonly: boolean;
  readonly_at: string | null;
  has_dispute: boolean;
} | null> {
  const { data, error } = await supabase
    .from('chat_lifecycle_config')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  const now = new Date();
  const readonlyAt = data.chat_readonly_at ? new Date(data.chat_readonly_at) : null;
  
  return {
    is_open: !readonlyAt || now < readonlyAt,
    is_readonly: readonlyAt ? now >= readonlyAt : false,
    readonly_at: data.chat_readonly_at,
    has_dispute: data.has_dispute,
  };
}

// Format time remaining for SLA
export function formatSlaRemaining(deadline: string | null): string {
  if (!deadline) return 'No deadline';
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Overdue';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  
  return `${hours}h ${minutes}m remaining`;
}

// Check if SLA is critical (less than 2 hours)
export function isSlaSlaCritical(deadline: string | null): boolean {
  if (!deadline) return false;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000; // Less than 2 hours
}
