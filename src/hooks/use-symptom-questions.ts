import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type SymptomQuestion = {
  symptom_key: string;
  question_key: string;
  question_label: string;
  question_type: 'yes_no' | 'single_choice' | 'multi_choice' | 'numeric' | 'photo' | 'audio';
  options: string[];
  helps_mechanic_with: string;
  affects_quote: boolean;
  affects_safety: boolean;
  affects_tools: boolean;
  order_index: number;
};

export function useSymptomQuestions(symptomKey: string | null) {
  const [questions, setQuestions] = useState<SymptomQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (symptomKey) {
      fetchQuestions(symptomKey);
    } else {
      setQuestions([]);
    }
  }, [symptomKey]);

  const fetchQuestions = async (key: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', key)
        .order('order_index');

      if (fetchError) throw fetchError;

      setQuestions((data as SymptomQuestion[]) || []);
    } catch (e: any) {
      console.error('Failed to fetch symptom questions:', e);
      setError(e?.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    if (symptomKey) {
      fetchQuestions(symptomKey);
    }
  };

  return { questions, loading, error, refetch };
}
