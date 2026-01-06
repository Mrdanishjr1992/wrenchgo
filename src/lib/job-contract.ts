import { supabase } from './supabase';
import type {
  JobContract,
  JobProgress,
  JobEvent,
  AcceptQuoteResponse,
  JobActionResponse,
  CancelJobResponse,
  CancellationReason,
} from '../types/job-lifecycle';

// =====================================================
// ACCEPT QUOTE & CREATE CONTRACT
// =====================================================

export async function acceptQuoteAndCreateContract(
  quoteId: string
): Promise<AcceptQuoteResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const customerId = userData.user?.id;
  
  if (!customerId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('accept_quote_and_create_contract', {
    p_quote_id: quoteId,
    p_customer_id: customerId,
  });
  
  if (error) {
    console.error('Accept quote error:', error);
    return { success: false, error: error.message };
  }
  
  return data as AcceptQuoteResponse;
}

// =====================================================
// MECHANIC ACTIONS
// =====================================================

export async function mechanicMarkDeparted(
  jobId: string,
  options?: {
    departureLat?: number;
    departureLng?: number;
    estimatedArrivalMinutes?: number;
  }
): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('mechanic_mark_departed', {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
    p_departure_lat: options?.departureLat ?? null,
    p_departure_lng: options?.departureLng ?? null,
    p_estimated_arrival_minutes: options?.estimatedArrivalMinutes ?? null,
  });
  
  if (error) {
    console.error('Mark departed error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

export async function mechanicMarkArrived(
  jobId: string,
  options?: {
    arrivalLat?: number;
    arrivalLng?: number;
  }
): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('mechanic_mark_arrived', {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
    p_arrival_lat: options?.arrivalLat ?? null,
    p_arrival_lng: options?.arrivalLng ?? null,
  });
  
  if (error) {
    console.error('Mark arrived error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

export async function mechanicStartWork(jobId: string): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('mechanic_start_work', {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
  });
  
  if (error) {
    console.error('Start work error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

export async function mechanicMarkComplete(
  jobId: string,
  workSummary?: string
): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('mechanic_mark_complete', {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
    p_work_summary: workSummary ?? null,
  });
  
  if (error) {
    console.error('Mark complete error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

// =====================================================
// CUSTOMER ACTIONS
// =====================================================

export async function customerConfirmArrival(jobId: string): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const customerId = userData.user?.id;
  
  if (!customerId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('customer_confirm_arrival', {
    p_job_id: jobId,
    p_customer_id: customerId,
  });
  
  if (error) {
    console.error('Confirm arrival error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

export async function customerConfirmComplete(jobId: string): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const customerId = userData.user?.id;
  
  if (!customerId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('customer_confirm_complete', {
    p_job_id: jobId,
    p_customer_id: customerId,
  });
  
  if (error) {
    console.error('Confirm complete error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

// =====================================================
// CANCELLATION
// =====================================================

export async function cancelJob(
  jobId: string,
  reason: CancellationReason,
  note?: string
): Promise<CancelJobResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('cancel_job', {
    p_job_id: jobId,
    p_cancelled_by: userId,
    p_reason: reason,
    p_note: note ?? null,
  });
  
  if (error) {
    console.error('Cancel job error:', error);
    return { success: false, error: error.message };
  }
  
  return data as CancelJobResponse;
}

// =====================================================
// DATA FETCHING
// =====================================================

export async function getJobContract(jobId: string): Promise<JobContract | null> {
  const { data, error } = await supabase
    .from('job_contracts')
    .select('*')
    .eq('job_id', jobId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Get contract error:', error);
    return null;
  }
  
  return data as JobContract;
}

export async function getJobProgress(jobId: string): Promise<JobProgress | null> {
  const { data, error } = await supabase
    .from('job_progress')
    .select('*')
    .eq('job_id', jobId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Get progress error:', error);
    return null;
  }
  
  return data as JobProgress;
}

export async function getJobEvents(
  jobId: string,
  limit: number = 50
): Promise<JobEvent[]> {
  const { data, error } = await supabase
    .from('job_events')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Get events error:', error);
    return [];
  }
  
  return (data ?? []) as JobEvent[];
}

export async function getContractWithDetails(jobId: string) {
  const [contract, progress, events] = await Promise.all([
    getJobContract(jobId),
    getJobProgress(jobId),
    getJobEvents(jobId),
  ]);
  
  return { contract, progress, events };
}

// =====================================================
// SUBSCRIPTIONS
// =====================================================

export function subscribeToJobProgress(
  jobId: string,
  callback: (progress: JobProgress) => void
) {
  return supabase
    .channel(`job-progress-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_progress',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as JobProgress);
        }
      }
    )
    .subscribe();
}

export function subscribeToJobContract(
  jobId: string,
  callback: (contract: JobContract) => void
) {
  return supabase
    .channel(`job-contract-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_contracts',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as JobContract);
        }
      }
    )
    .subscribe();
}

export function subscribeToJobEvents(
  jobId: string,
  callback: (event: JobEvent) => void
) {
  return supabase
    .channel(`job-events-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'job_events',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as JobEvent);
        }
      }
    )
    .subscribe();
}
