import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import type {
  MechanicLead,
  LeadsSummary,
  LeadFilterType,
  LeadSortType,
} from '@/src/types/mechanic-leads';

interface ProfileStatus {
  hasLocation: boolean;
  isInServiceArea: boolean;
  homeLat: number | null;
  homeLng: number | null;
}

interface UseMechanicLeadsResult {
  leads: MechanicLead[];
  summary: LeadsSummary | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sortBy: LeadSortType;
  profileStatus: ProfileStatus | null;
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
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);

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

  const checkProfileStatus = useCallback(async (mechId: string): Promise<ProfileStatus> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_lat, home_lng')
        .eq('id', mechId)
        .single();

      const hasLocation = profile?.home_lat != null && profile?.home_lng != null;
      
      let isInServiceArea = false;
      if (hasLocation && profile?.home_lat && profile?.home_lng) {
        const { data: hubCheck } = await supabase.rpc('check_mechanic_service_area', {
          p_mechanic_id: mechId
        });
        isInServiceArea = hubCheck === true;
      }

      return {
        hasLocation,
        isInServiceArea: hasLocation ? isInServiceArea : false,
        homeLat: profile?.home_lat ?? null,
        homeLng: profile?.home_lng ?? null,
      };
    } catch (err) {
      console.error('Error checking profile status:', err);
      return {
        hasLocation: false,
        isInServiceArea: false,
        homeLat: null,
        homeLng: null,
      };
    }
  }, []);

  const loadMore = useCallback(async () => {
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
        p_mechanic_lat: mechanicLat ?? null,
        p_mechanic_lng: mechanicLng ?? null,
        p_radius_miles: radiusMiles,
        p_limit: LEADS_PER_PAGE,
        p_offset: currentOffset,
        p_sort_by: sortBy,
      });

      if (rpcError) throw rpcError;
      if (!isMountedRef.current) return;

      const newLeads = (data || []) as MechanicLead[];

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

      offsetRef.current = nextOffset;
      hasMoreRef.current = newLeads.length === LEADS_PER_PAGE;

      setOffset(nextOffset);
      setHasMore(newLeads.length === LEADS_PER_PAGE);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching more mechanic leads:', err);
      setError(err instanceof Error ? err.message : JSON.stringify(err));
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

    loadingRef.current = true;
    offsetRef.current = 0;
    hasMoreRef.current = true;

    setOffset(0);
    setHasMore(true);
    setLoading(true);
    setError(null);

    try {
      const [leadsResult, summaryResult, profileStatusResult] = await Promise.all([
        supabase.rpc('get_mechanic_leads', {
          p_mechanic_id: mechanicId,
          p_filter: filter,
          p_mechanic_lat: mechanicLat ?? null,
          p_mechanic_lng: mechanicLng ?? null,
          p_radius_miles: radiusMiles,
          p_limit: LEADS_PER_PAGE,
          p_offset: 0,
          p_sort_by: sortBy,
        }),
        supabase.rpc('get_mechanic_leads_summary', {
          p_mechanic_id: mechanicId,
          p_mechanic_lat: mechanicLat ?? null,
          p_mechanic_lng: mechanicLng ?? null,
          p_radius_miles: radiusMiles,
        }),
        checkProfileStatus(mechanicId),
      ]);

      if (!isMountedRef.current) return;

      if (leadsResult.error) throw leadsResult.error;

      const newLeads = (leadsResult.data || []) as MechanicLead[];

      setLeads(newLeads);
      setProfileStatus(profileStatusResult);

      const nextOffset = LEADS_PER_PAGE;
      const nextHasMore = newLeads.length === LEADS_PER_PAGE;

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
      setError(err instanceof Error ? err.message : JSON.stringify(err));
    } finally {
      if (isMountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [mechanicId, filter, mechanicLat, mechanicLng, radiusMiles, sortBy, checkProfileStatus]);

  const changeSortBy = useCallback((newSortBy: LeadSortType) => {
    setSortBy(newSortBy);
  }, []);

  useEffect(() => {
    if (!mechanicId) {
      setLoading(false);
      return;
    }

    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId, filter, sortBy]);

  return {
    leads,
    summary,
    loading,
    error,
    hasMore,
    sortBy,
    profileStatus,
    refetch,
    loadMore,
    changeSortBy,
  };
}
