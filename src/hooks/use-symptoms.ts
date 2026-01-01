import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type SymptomListItem = {
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  quote_strategy: string | null;
  customer_explainer: string | null;

  // optional extras
  required_skill_keys: string[];
  suggested_tool_keys: string[];
  required_safety_keys: string[];

  // from public.symptoms (optional)
  icon?: string | null;
};

export function useSymptoms() {
  const [symptoms, setSymptoms] = useState<SymptomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSymptoms = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Primary source: symptom_mappings
      // ✅ Left join symptoms to get icon if it exists
      const { data, error: fetchError } = await supabase
        .from("symptom_mappings")
        .select(
          `
          symptom_key,
          symptom_label,
          category,
          risk_level,
          quote_strategy,
          customer_explainer,
          required_skill_keys,
          suggested_tool_keys,
          required_safety_keys,
          symptoms: symptoms ( icon )
        `
        )
        .order("category", { ascending: true })
        .order("symptom_label", { ascending: true });

      if (fetchError) throw fetchError;

      const rows =
        (data ?? []).map((row: any) => ({
          symptom_key: row.symptom_key,
          symptom_label: row.symptom_label,
          category: row.category,
          risk_level: row.risk_level,
          quote_strategy: row.quote_strategy ?? null,
          customer_explainer: row.customer_explainer ?? null,
          required_skill_keys: row.required_skill_keys ?? [],
          suggested_tool_keys: row.suggested_tool_keys ?? [],
          required_safety_keys: row.required_safety_keys ?? [],
          icon: row.symptoms?.icon ?? null,
        })) ?? [];

      setSymptoms(rows);
    } catch (e: any) {
      console.error("Failed to fetch symptoms:", e);
      setError(e?.message || "Failed to load symptoms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymptoms();
  }, []);

  return { symptoms, loading, error, refetch: fetchSymptoms };
}
