import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type SymptomMapping = {
  symptom_key: string;
  symptom_label: string;
  category: string;
  required_skill_keys: string[];
  suggested_tool_keys: string[];
  required_safety_keys: string[];
  quote_strategy: string;
  risk_level: string;
  customer_explainer: string;
  mechanic_notes: string;
};

export function useSymptoms() {
  const [symptoms, setSymptoms] = useState<SymptomMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSymptoms();
  }, []);

  const fetchSymptoms = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('symptom_mappings')
        .select('*')
        .order('symptom_label');

      if (fetchError) throw fetchError;

      setSymptoms((data as SymptomMapping[]) || []);
    } catch (e: any) {
      console.error('Failed to fetch symptoms:', e);
      setError(e?.message || 'Failed to load symptoms');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchSymptoms();
  };

  return { symptoms, loading, error, refetch };
}
