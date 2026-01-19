import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// =====================================================
// Types
// =====================================================

export interface AdminScope {
  isSuper: boolean;
  hubId: string | null;
  hubName: string | null;
  loading: boolean;
  error: string | null;
}

export interface AdminFilters {
  hubId: string | null;
  status: string | null;
  search: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  limit: number;
  offset: number;
}

export interface AdminHub {
  id: string;
  name: string;
}

// =====================================================
// useAdminScope Hook
// =====================================================

export function useAdminScope(): AdminScope {
  const [scope, setScope] = useState<AdminScope>({
    isSuper: true, // Default to super admin for now
    hubId: null,
    hubName: null,
    loading: false,
    error: null,
  });

  return scope;
}

// =====================================================
// useAdminFilters Hook
// =====================================================

export function useAdminFilters(initialLimit = 50) {
  const [filters, setFilters] = useState<AdminFilters>({
    hubId: null,
    status: null,
    search: '',
    dateFrom: null,
    dateTo: null,
    limit: initialLimit,
    offset: 0,
  });

  const updateFilter = useCallback(<K extends keyof AdminFilters>(key: K, value: AdminFilters[K]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: key !== 'offset' ? 0 : prev.offset,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      hubId: null,
      status: null,
      search: '',
      dateFrom: null,
      dateTo: null,
      limit: initialLimit,
      offset: 0,
    });
  }, [initialLimit]);

  const nextPage = useCallback(() => {
    setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  }, []);

  const prevPage = useCallback(() => {
    setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  }, []);

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  return {
    filters,
    updateFilter,
    resetFilters,
    nextPage,
    prevPage,
    currentPage,
  };
}

// =====================================================
// useAdminHubs Hook
// =====================================================

export function useAdminHubs() {
  const [hubs, setHubs] = useState<AdminHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHubs() {
      try {
        const { data, error: fetchError } = await supabase
          .from('service_hubs')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (fetchError) throw fetchError;
        setHubs(data || []);
      } catch (err: any) {
        console.error('Error fetching hubs:', err);
        setError(err?.message || 'Failed to load hubs');
      } finally {
        setLoading(false);
      }
    }

    fetchHubs();
  }, []);

  return { hubs, loading, error };
}

// =====================================================
// Status Constants - VALIDATED AGAINST SCHEMA
// =====================================================

// job_status enum: draft, searching, quoted, accepted, scheduled, in_progress, work_in_progress, completed, cancelled, disputed
export const JOB_STATUSES = [
  { value: null, label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'searching', label: 'Searching' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'disputed', label: 'Disputed' },
] as const;

// dispute_status enum: open, under_review, evidence_requested, resolved_customer, resolved_mechanic, resolved_split, closed
export const DISPUTE_STATUSES = [
  { value: null, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'evidence_requested', label: 'Evidence Requested' },
  { value: 'resolved_customer', label: 'Resolved (Customer)' },
  { value: 'resolved_mechanic', label: 'Resolved (Mechanic)' },
  { value: 'resolved_split', label: 'Resolved (Split)' },
  { value: 'closed', label: 'Closed' },
] as const;

// payment_status enum: pending, processing, succeeded, failed, refunded, partially_refunded
export const PAYMENT_STATUSES = [
  { value: null, label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
] as const;

// payout_status enum: pending, processing, completed, failed, held, cancelled
export const PAYOUT_STATUSES = [
  { value: null, label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'held', label: 'Held' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

// support_requests.status: open, resolved (text check constraint)
export const SUPPORT_STATUSES = [
  { value: null, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
] as const;

// waitlist status - based on invited_at/converted_at columns
export const WAITLIST_STATUSES = [
  { value: null, label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'invited', label: 'Invited' },
  { value: 'converted', label: 'Converted' },
] as const;
