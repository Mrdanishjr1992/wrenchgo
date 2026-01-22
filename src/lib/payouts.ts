import { supabase } from './supabase';
import type { Payout, PayoutStatus } from '../types/job-lifecycle';

// =====================================================
// DATA FETCHING
// =====================================================

export async function getMechanicPayouts(
  options?: {
    status?: PayoutStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ payouts: Payout[]; total: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { payouts: [], total: 0 };
  }
  
  let query = supabase
    .from('payouts')
    .select('*', { count: 'exact' })
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false });
  
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 10) - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    console.error('Get payouts error:', error);
    return { payouts: [], total: 0 };
  }
  
  return {
    payouts: (data ?? []) as Payout[],
    total: count ?? 0,
  };
}

export async function getPayoutByContractId(contractId: string): Promise<Payout | null> {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('contract_id', contractId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Get payout error:', error);
    return null;
  }
  
  return data as Payout;
}

// =====================================================
// EARNINGS SUMMARY
// =====================================================

export interface EarningsSummary {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  heldPayouts: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  jobsCompleted: number;
  avgJobValue: number;
}

export async function getMechanicEarningsSummary(): Promise<EarningsSummary | null> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return null;
  }
  
  // Get all payouts
  const { data: payouts, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('mechanic_id', mechanicId);
  
  if (error) {
    console.error('Get earnings error:', error);
    return null;
  }
  
  const allPayouts = (payouts ?? []) as Payout[];
  
  // Calculate totals
  const completed = allPayouts.filter(p => p.status === 'completed');
  const pending = allPayouts.filter(p => p.status === 'pending' || p.status === 'processing');
  const held = allPayouts.filter(p => p.status === 'held');
  
  const totalEarnings = completed.reduce((sum, p) => sum + p.net_amount_cents, 0);
  const pendingPayouts = pending.reduce((sum, p) => sum + p.net_amount_cents, 0);
  const heldPayouts = held.reduce((sum, p) => sum + p.net_amount_cents, 0);
  
  // Calculate this month and last month
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const thisMonthPayouts = completed.filter(p => 
    new Date(p.processed_at ?? p.created_at) >= thisMonthStart
  );
  const lastMonthPayouts = completed.filter(p => {
    const date = new Date(p.processed_at ?? p.created_at);
    return date >= lastMonthStart && date <= lastMonthEnd;
  });
  
  const thisMonthEarnings = thisMonthPayouts.reduce((sum, p) => sum + p.net_amount_cents, 0);
  const lastMonthEarnings = lastMonthPayouts.reduce((sum, p) => sum + p.net_amount_cents, 0);
  
  return {
    totalEarnings,
    pendingPayouts,
    completedPayouts: totalEarnings,
    heldPayouts,
    thisMonthEarnings,
    lastMonthEarnings,
    jobsCompleted: completed.length,
    avgJobValue: completed.length > 0 ? Math.round(totalEarnings / completed.length) : 0,
  };
}

// =====================================================
// PAYOUT STATUS HELPERS
// =====================================================

export function getPayoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'processing': return 'Processing';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'held': return 'On Hold';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

export function getPayoutStatusColor(status: PayoutStatus): string {
  switch (status) {
    case 'pending': return '#F59E0B'; // amber
    case 'processing': return '#3B82F6'; // blue
    case 'completed': return '#10B981'; // green
    case 'failed': return '#EF4444'; // red
    case 'held': return '#F97316'; // orange
    case 'cancelled': return '#6B7280'; // gray
    default: return '#6B7280';
  }
}

// =====================================================
// SUBSCRIPTIONS
// =====================================================

export function subscribeToPayouts(
  mechanicId: string,
  callback: (payout: Payout) => void
) {
  return supabase
    .channel(`payouts-${mechanicId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payouts',
        filter: `mechanic_id=eq.${mechanicId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as Payout);
        }
      }
    )
    .subscribe();
}
