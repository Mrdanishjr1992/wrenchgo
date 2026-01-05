import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type SymptomListItem = {
  symptom_key: string;
  symptom_label: string;
  category: string;
  risk_level: string;
  quote_strategy: string | null;
  customer_explainer: string | null;

  required_skill_keys: string[];
  suggested_tool_keys: string[];
  required_safety_keys: string[];

  icon?: string | null;
};

const FALLBACK_ICON = "🛠️";

function normalizeRisk(risk: unknown): "high" | "medium" | "low" {
  const v = String(risk ?? "").toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

export function useSymptoms() {
  const [symptoms, setSymptoms] = useState<SymptomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSymptoms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /**
       * IMPORTANT:
       * Use explicit FK embed so PostgREST always returns the joined row.
       * symptom_mappings.symptom_key -> symptoms.key
       */
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
          symptom:symptoms!symptom_mappings_symptom_key_fkey (
            icon,
            label,
            key
          )
        `
        );

      if (fetchError) throw fetchError;

      const rows: SymptomListItem[] =
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
          icon: row.symptom?.icon ?? FALLBACK_ICON,
        })) ?? [];

      // Better UX ordering: risk first, then category, then label
      const riskOrder: Record<"high" | "medium" | "low", number> = {
        high: 0,
        medium: 1,
        low: 2,
      };

      rows.sort((a, b) => {
        const ra = normalizeRisk(a.risk_level);
        const rb = normalizeRisk(b.risk_level);
        const rd = riskOrder[ra] - riskOrder[rb];
        if (rd !== 0) return rd;

        const cd = a.category.localeCompare(b.category);
        if (cd !== 0) return cd;

        return a.symptom_label.localeCompare(b.symptom_label);
      });

      setSymptoms(rows);
    } catch (e: any) {
      console.error("Failed to fetch symptoms:", e);
      setError(e?.message || "Failed to load symptoms");
      setSymptoms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSymptoms();
  }, [fetchSymptoms]);

  return { symptoms, loading, error, refetch: fetchSymptoms };
}
