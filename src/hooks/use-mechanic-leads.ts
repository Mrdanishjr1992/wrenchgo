import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import type {
  MechanicLead,
  LeadsSummary,
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

  const isMountedRef = useRef(true);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadMore = useCallback(async () => {
    // Guard hard: prevents UI onEndReached spam + stale offset calls
    if (!mechanicId) return;
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const currentOffset = offsetRef.current;

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
      if (!isMountedRef.current) return;

      const newLeads = (data || []) as MechanicLead[];

      // If backend can return duplicates (realtime + pagination), de-dupe by job_id
      setLeads((prev) => {
        const seen = new Set(prev.map((l) => l.job_id));
        const merged = [...prev];
        for (const l of newLeads) {
          if (!seen.has(l.job_id)) {
            merged.push(l);
            seen.add(l.job_id);
          }
        }
        return merged;
      });

      const nextOffset = currentOffset + LEADS_PER_PAGE;

      // Keep refs in sync immediately (do NOT wait for state effects)
      offsetRef.current = nextOffset;
      hasMoreRef.current = newLeads.length === LEADS_PER_PAGE;

      setOffset(nextOffset);
      setHasMore(newLeads.length === LEADS_PER_PAGE);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching more mechanic leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more leads');
    } finally {
      if (isMountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [mechanicId, filter, mechanicLat, mechanicLng, radiusMiles, sortBy]);

  const refetch = useCallback(async () => {
    if (!mechanicId) return;

    // Reset state + refs up-front so UI cannot call loadMore with stale offset
    loadingRef.current = true;
    offsetRef.current = 0;
    hasMoreRef.current = true;

    setOffset(0);
    setHasMore(true);
    setLoading(true);
    setError(null);

    try {
      const [leadsResult, summaryResult] = await Promise.all([
        supabase.rpc('get_mechanic_leads', {
          p_mechanic_id: mechanicId,
          p_filter: filter,
          p_mechanic_lat: mechanicLat,
          p_mechanic_lng: mechanicLng,
          p_radius_miles: radiusMiles,
          p_limit: LEADS_PER_PAGE,
          p_offset: 0,
          p_sort_by: sortBy,
        }),
        supabase.rpc('get_mechanic_leads_summary', {
          p_mechanic_id: mechanicId,
          p_mechanic_lat: mechanicLat,
          p_mechanic_lng: mechanicLng,
          p_radius_miles: radiusMiles,
        }),
      ]);

      if (!isMountedRef.current) return;

      if (leadsResult.error) throw leadsResult.error;

      const newLeads = (leadsResult.data || []) as MechanicLead[];

      setLeads(newLeads);

      const nextOffset = LEADS_PER_PAGE;
      const nextHasMore = newLeads.length === LEADS_PER_PAGE;

      // Keep refs in sync immediately
      offsetRef.current = nextOffset;
      hasMoreRef.current = nextHasMore;

      setOffset(nextOffset);
      setHasMore(nextHasMore);

      if (summaryResult.data && summaryResult.data.length > 0) {
        setSummary(summaryResult.data[0] as LeadsSummary);
      } else {
        setSummary(null);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching mechanic leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      if (isMountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [mechanicId, filter, mechanicLat, mechanicLng, radiusMiles, sortBy]);

  const changeSortBy = useCallback((newSortBy: LeadSortType) => {
    setSortBy(newSortBy);
  }, []);

  useEffect(() => {
    if (!mechanicId) {
      setLoading(false);
      return;
    }

    // When key inputs change, refetch once
    refetch();
  }, [mechanicId, filter, sortBy, refetch]);

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
