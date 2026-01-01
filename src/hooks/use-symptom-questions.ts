import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type SymptomQuestionType =
  | "yes_no"
  | "single_choice"
  | "multi_choice"
  | "numeric"
  | "photo"
  | "audio";

export type SymptomQuestion = {
  id: string;
  symptom_key: string;
  question_key: string;
  question_label: string; // mapped from question_text
  question_type: SymptomQuestionType;
  options: string[];
  affects_quote: boolean;
  affects_safety: boolean;
  affects_tools: boolean;
  display_order: number;
};

function coerceOptions(options: any): string[] {
  // supports jsonb being:
  // - ["A","B"]
  // - { options: ["A","B"] }
  // - [{label:"A"}, {label:"B"}]
  if (!options) return [];
  if (Array.isArray(options)) {
    if (options.every((x) => typeof x === "string")) return options;
    if (options.every((x) => typeof x?.label === "string")) return options.map((x) => x.label);
  }
  if (Array.isArray(options?.options)) {
    if (options.options.every((x: any) => typeof x === "string")) return options.options;
    if (options.options.every((x: any) => typeof x?.label === "string"))
      return options.options.map((x: any) => x.label);
  }
  return [];
}

export function useSymptomQuestions(symptomKey: string | null) {
  const [questions, setQuestions] = useState<SymptomQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async (key: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("symptom_questions")
        .select(
          "id,symptom_key,question_key,question_text,question_type,options,affects_quote,affects_safety,affects_tools,display_order"
        )
        .eq("symptom_key", key)
        .order("display_order", { ascending: true }); // ✅ correct column

      if (fetchError) throw fetchError;

      const mapped: SymptomQuestion[] =
        (data ?? []).map((q: any) => ({
          id: q.id,
          symptom_key: q.symptom_key,
          question_key: q.question_key,
          question_label: q.question_text, // ✅ map
          question_type: q.question_type,
          options: coerceOptions(q.options),
          affects_quote: !!q.affects_quote,
          affects_safety: !!q.affects_safety,
          affects_tools: !!q.affects_tools,
          display_order: q.display_order ?? 0,
        })) ?? [];

      setQuestions(mapped);
    } catch (e: any) {
      console.error("Failed to fetch symptom questions:", e);
      setError(e?.message || "Failed to load questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!symptomKey) {
      setQuestions([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchQuestions(symptomKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symptomKey]);

  return { questions, loading, error, refetch: () => symptomKey && fetchQuestions(symptomKey) };
}
