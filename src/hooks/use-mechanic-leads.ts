import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import type {
  MechanicLead,
  LeadsSummary,
  MechanicLeadsParams,
  LeadFilterType,
  LeadSortType,
} from '@/src/types/mechanic-leads';

interface UseMechanicLeadsResult {
  leads: MechanicLead[];
  summary: LeadsSummary | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sortBy: LeadSortType;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  changeSortBy: (sortBy: LeadSortType) => void;
}

const LEADS_PER_PAGE = 20;

export function useMechanicLeads(
  mechanicId: string | null,
  filter: LeadFilterType,
  mechanicLat?: number | null,
  mechanicLng?: number | null,
  radiusMiles: number = 25
): UseMechanicLeadsResult {
  const [leads, setLeads] = useState<MechanicLead[]>([]);
  const [summary, setSummary] = useState<LeadsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<LeadSortType>('newest');

  const fetchLeads = useCallback(
    async (reset: boolean = false) => {
      if (!mechanicId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;

        const { data, error: rpcError } = await supabase.rpc('get_mechanic_leads', {
          p_mechanic_id: mechanicId,
          p_filter: filter,
          p_mechanic_lat: mechanicLat,
          p_mechanic_lng: mechanicLng,
          p_radius_miles: radiusMiles,
          p_limit: LEADS_PER_PAGE,
          p_offset: currentOffset,
          p_sort_by: sortBy,
        });

        if (rpcError) throw rpcError;

        const newLeads = (data || []) as MechanicLead[];

        if (reset) {
          setLeads(newLeads);
          setOffset(LEADS_PER_PAGE);
        } else {
          setLeads((prev) => [...prev, ...newLeads]);
          setOffset((prev) => prev + LEADS_PER_PAGE);
        }

        setHasMore(newLeads.length === LEADS_PER_PAGE);
      } catch (err) {
        console.error('Error fetching mechanic leads:', err);
        setError(err instanceof Error ? err.message : 'Failed to load leads');
      } finally {
        setLoading(false);
      }
    },
    [mechanicId, filter, mechanicLat, mechanicLng, radiusMiles, sortBy]
  );

  const fetchSummary = useCallback(async () => {
    if (!mechanicId) return;

    try {
      const { data, error: summaryError } = await supabase.rpc('get_mechanic_leads_summary', {
        p_mechanic_id: mechanicId,
        p_mechanic_lat: mechanicLat,
        p_mechanic_lng: mechanicLng,
        p_radius_miles: radiusMiles,
      });

      if (summaryError) throw summaryError;

      if (data && data.length > 0) {
        setSummary(data[0] as LeadsSummary);
      }
    } catch (err) {
      console.error('Error fetching leads summary:', err);
    }
  }, [mechanicId, mechanicLat, mechanicLng, radiusMiles]);

  const refetch = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await Promise.all([fetchLeads(true), fetchSummary()]);
  }, [fetchLeads, fetchSummary]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchLeads(false);
    }
  }, [loading, hasMore, fetchLeads]);

  const changeSortBy = useCallback((newSortBy: LeadSortType) => {
    setSortBy(newSortBy);
    setOffset(0);
    setHasMore(true);
  }, []);

  useEffect(() => {
    if (mechanicId) {
      refetch();
    }
  }, [mechanicId, filter, sortBy]);

  useEffect(() => {
    if (mechanicId) {
      fetchSummary();
    }
  }, [mechanicId, mechanicLat, mechanicLng, radiusMiles]);

  return {
    leads,
    summary,
    loading,
    error,
    hasMore,
    sortBy,
    refetch,
    loadMore,
    changeSortBy,
  };
}
