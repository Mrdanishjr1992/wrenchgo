import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PlatformTerms {
  version: string;
  title: string;
  summary: string;
  full_text: string;
  published_at: string;
}

export interface TermsStatus {
  accepted: boolean;
  version: string | null;
  requires_acceptance: boolean;
}

export function useTerms(role: 'customer' | 'mechanic') {
  const [terms, setTerms] = useState<PlatformTerms | null>(null);
  const [status, setStatus] = useState<TermsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const checkTermsAccepted = useCallback(async (): Promise<TermsStatus> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_terms_accepted', { p_role: role });
      if (error) throw error;
      const result = data as TermsStatus;
      setStatus(result);
      return result;
    } catch (e) {
      console.error('Error checking terms:', e);
      return { accepted: false, version: null, requires_acceptance: true };
    } finally {
      setLoading(false);
    }
  }, [role]);

  const fetchActiveTerms = useCallback(async (): Promise<PlatformTerms | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_terms', { p_role: role });
      if (error) throw error;
      if (data && data.length > 0) {
        setTerms(data[0]);
        return data[0];
      }
      return null;
    } catch (e) {
      console.error('Error fetching terms:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [role]);

  const acceptTerms = useCallback(async (version: string): Promise<boolean> => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_platform_terms', {
        p_terms_version: version,
        p_role: role,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      if (error) throw error;
      if (data?.success) {
        setStatus({ accepted: true, version, requires_acceptance: false });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error accepting terms:', e);
      return false;
    } finally {
      setAccepting(false);
    }
  }, [role]);

  return {
    terms,
    status,
    loading,
    accepting,
    checkTermsAccepted,
    fetchActiveTerms,
    acceptTerms,
  };
}

export const CUSTOMER_ACKNOWLEDGEMENT_BULLETS = [
  'I confirm I own or am authorized to request service on this vehicle.',
  'I understand WrenchGo is a marketplace; the mechanic is an independent provider.',
  'Diagnostics may reveal additional issues; pricing may change only with my approval.',
  'I will provide a safe, accessible workspace and accurate information.',
];

export const MECHANIC_ACKNOWLEDGEMENT_BULLETS = [
  'I am an independent provider and responsible for my work and safety practices.',
  'I will communicate any additional required work and obtain approval before charging.',
  'I will follow safe procedures and stop work if conditions are unsafe.',
  'I will not request off-platform payment or contact outside the app.',
];

export function useJobAcknowledgement() {
  const [accepting, setAccepting] = useState(false);

  const acceptAcknowledgement = useCallback(async (
    jobId: string,
    role: 'customer' | 'mechanic',
    version: string = 'ACK_2026.01'
  ): Promise<boolean> => {
    setAccepting(true);
    const bullets = role === 'customer' 
      ? CUSTOMER_ACKNOWLEDGEMENT_BULLETS 
      : MECHANIC_ACKNOWLEDGEMENT_BULLETS;
    const ackText = bullets.join('\n');

    try {
      const { data, error } = await supabase.rpc('accept_job_acknowledgement', {
        p_job_id: jobId,
        p_role: role,
        p_ack_version: version,
        p_ack_text: ackText,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      if (error) throw error;
      return data?.success ?? false;
    } catch (e) {
      console.error('Error accepting job acknowledgement:', e);
      return false;
    } finally {
      setAccepting(false);
    }
  }, []);

  const checkAcknowledgement = useCallback(async (
    jobId: string,
    userId: string,
    role: 'customer' | 'mechanic'
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('job_acknowledgements')
        .select('id')
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    } catch (e) {
      console.error('Error checking acknowledgement:', e);
      return false;
    }
  }, []);

  return {
    accepting,
    acceptAcknowledgement,
    checkAcknowledgement,
  };
}
