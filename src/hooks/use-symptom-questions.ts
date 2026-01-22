import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type SymptomQuestionType =
  | "yes_no"
  | "single_choice"
  | "multi_choice"
  | "numeric"
  | "photo"
  | "audio"
  | "text"; // ✅ include because older data often uses "text"

export type SymptomQuestion = {
  id: string;
  symptom_key: string;
  question_key: string;
  question_label: string;
  question_type: SymptomQuestionType;
  options: string[];
  affects_quote: boolean;
  affects_safety: boolean;
  affects_tools: boolean;
  display_order: number;
};

function normalizeQuestionType(v: any): SymptomQuestionType {
  const t = String(v ?? "").toLowerCase();
  if (t === "yes_no") return "yes_no";
  if (t === "single_choice") return "single_choice";
  if (t === "multi_choice") return "multi_choice";
  if (t === "numeric") return "numeric";
  if (t === "photo") return "photo";
  if (t === "audio") return "audio";
  // common legacy values
  if (t === "choice") return "single_choice";
  if (t === "text") return "text";
  // safest default
  return "single_choice";
}

function coerceOptions(raw: any): string[] {
  if (!raw) return [];

  // ✅ handle stringified JSON
  if (typeof raw === "string") {
    try {
      return coerceOptions(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  // supports jsonb being:
  // - ["A","B"]
  // - { options: ["A","B"] }
  // - [{label:"A"}, {label:"B"}]
  if (Array.isArray(raw)) {
    if (raw.every((x) => typeof x === "string")) return raw;
    if (raw.every((x) => typeof x?.label === "string")) return raw.map((x) => x.label);
  }

  if (Array.isArray(raw?.options)) {
    const arr = raw.options;
    if (arr.every((x: any) => typeof x === "string")) return arr;
    if (arr.every((x: any) => typeof x?.label === "string")) return arr.map((x: any) => x.label);
  }

  return [];
}

export function useSymptomQuestions(symptomKey: string | null) {
  const [questions, setQuestions] = useState<SymptomQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ prevents race-condition overwrites
  const requestIdRef = useRef(0);

  const fetchQuestions = useCallback(async (key: string) => {
    const reqId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("symptom_questions")
        .select(
          "id,symptom_key,question_key,question_text,question_type,options,affects_quote,affects_safety,affects_tools,display_order"
        )
        .eq("symptom_key", key)
        .order("display_order", { ascending: true });

      if (fetchError) throw fetchError;

      // ✅ ignore stale responses
      if (reqId !== requestIdRef.current) return;

      const mapped: SymptomQuestion[] =
        (data ?? []).map((q: any) => ({
          id: String(q.id),
          symptom_key: String(q.symptom_key),
          question_key: String(q.question_key),
          question_label: String(q.question_text ?? ""),
          question_type: normalizeQuestionType(q.question_type),
          options: coerceOptions(q.options),
          affects_quote: !!q.affects_quote,
          affects_safety: !!q.affects_safety,
          affects_tools: !!q.affects_tools,
          display_order: Number(q.display_order ?? 0),
        })) ?? [];

      setQuestions(mapped);
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      console.error("Failed to fetch symptom questions:", e);
      setError(e?.message || "Failed to load questions");
      setQuestions([]);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!symptomKey) {
      requestIdRef.current++; // invalidate in-flight requests
      setQuestions([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchQuestions(symptomKey);
  }, [symptomKey, fetchQuestions]);

  const refetch = useCallback(async () => {
    if (!symptomKey) return;
    await fetchQuestions(symptomKey);
  }, [symptomKey, fetchQuestions]);

  return { questions, loading, error, refetch };
}
