export type RiskLevel = "low" | "medium" | "high";

export type SymptomMapping = {
  symptom_key: string;
  category: string;
  risk_level: RiskLevel;
  quote_strategy: string;
};

export type MatchType = "equals" | "in" | "contains" | "any";

export type RefinementRule = {
  symptom_key: string;
  question_key: string;
  match_type: MatchType;
  match_value: any; // jsonb
  override_category?: string | null;
  override_risk_level?: RiskLevel | null;
  override_quote_strategy?: string | null;
  priority?: number;
  is_active?: boolean;
};

function normalizeString(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
function unwrapValue(v: unknown): unknown {
  if (v && typeof v === "object" && "value" in (v as any)) return (v as any).value;
  return v;
}
function normalizeScalar(v: unknown): string | number | boolean | null {
  const u = unwrapValue(v);
  if (u === null || u === undefined) return null;
  if (typeof u === "string") return normalizeString(u);
  if (typeof u === "number" || typeof u === "boolean") return u;
  return normalizeString(String(u));
}
function normalizeToScalarArray(v: unknown): Array<string | number | boolean> {
  const u = unwrapValue(v);
  if (u === null || u === undefined) return [];
  if (Array.isArray(u)) {
    return u.map(unwrapValue).map(normalizeScalar).filter((x): x is any => x !== null);
  }
  const one = normalizeScalar(u);
  return one === null ? [] : [one];
}
function getNeedle(matchValue: any): string | null {
  if (typeof matchValue === "string") return normalizeString(matchValue);
  if (matchValue && typeof matchValue === "object" && "contains" in matchValue) {
    return normalizeString(String((matchValue as any).contains));
  }
  return null;
}
function matches(rule: RefinementRule, answerRaw: unknown): boolean {
  if (rule.match_type === "any") return normalizeToScalarArray(answerRaw).length > 0;

  const answerArr = normalizeToScalarArray(answerRaw);
  if (answerArr.length === 0) return false;

  const mv = rule.match_value;

  switch (rule.match_type) {
    case "equals": {
      const target = normalizeScalar(mv);
      if (target === null) return false;
      return answerArr.some((a) => a === target);
    }
    case "in": {
      const targets = normalizeToScalarArray(mv);
      if (targets.length === 0) return false;
      return answerArr.some((a) => targets.includes(a));
    }
    case "contains": {
      const needle = getNeedle(mv);
      if (!needle) return false;
      return answerArr.some((a) => String(a).toLowerCase().includes(needle.toLowerCase()));
    }
    default:
      return false;
  }
}

export function resolveSymptomMapping(
  base: SymptomMapping,
  rules: RefinementRule[],
  answersByQuestionKey: Record<string, unknown>
): SymptomMapping {
  const ordered = [...rules]
    .filter((r) => r.is_active !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  let resolved: SymptomMapping = { ...base, category: normalizeString(base.category) };

  for (const rule of ordered) {
    const answer = answersByQuestionKey[rule.question_key];
    if (!matches(rule, answer)) continue;

    if (rule.override_category) resolved.category = normalizeString(rule.override_category);
    if (rule.override_risk_level) resolved.risk_level = rule.override_risk_level;
    if (rule.override_quote_strategy) resolved.quote_strategy = rule.override_quote_strategy;
  }

  return resolved;
}
