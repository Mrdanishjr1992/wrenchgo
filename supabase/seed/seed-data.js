const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://your-project.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const VALID_RISK_LEVELS = ["low", "medium", "high"];
const VALID_QUOTE_STRATEGIES = [
  "diagnostic_only",
  "fixed_simple",
  "inspection_required",
];
const VALID_QUESTION_TYPES = [
  "yes_no",
  "single_choice",
  "multi_choice",
  "numeric",
  "photo",
  "audio",
];

// ---------- helpers ----------
const dedupe = (arr) => [...new Set((arr || []).filter(Boolean))];

function sanitizeText(s) {
  if (s == null) return "";
  return String(s)
    // common bad encoding from copy/paste (â€¢ etc.)
    .replace(/â€¢/g, "•")
    .replace(/\r\n/g, "\n")
    .trim();
}

function normalizeKey(s) {
  return sanitizeText(s).toLowerCase();
}

function toBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function toInt(v, fallback = 10) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- validation + normalization ----------
function validateAndNormalize(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Root JSON must be an object"], warnings };
  }

  if (!Array.isArray(raw.symptom_mappings)) {
    errors.push("Missing or invalid symptom_mappings array");
  }
  if (!Array.isArray(raw.symptom_questions)) {
    errors.push("Missing or invalid symptom_questions array");
  }

  if (errors.length) return { valid: false, errors, warnings };

  const seenSymptomKeys = new Set();
  const seenQuestionComposite = new Set();

  // ---- symptom_mappings (DB columns match your earlier schema) ----
  const symptom_mappings = raw.symptom_mappings
    .map((row, idx) => ({ row, idx }))
    .filter(({ row, idx }) => {
      if (!row.symptom_key || typeof row.symptom_key !== "string") {
        warnings.push(`symptom_mappings[${idx}]: Missing symptom_key, skipping`);
        return false;
      }
      const key = normalizeKey(row.symptom_key);
      if (seenSymptomKeys.has(key)) {
        warnings.push(
          `symptom_mappings[${idx}]: Duplicate symptom_key "${key}", skipping`
        );
        return false;
      }
      seenSymptomKeys.add(key);
      row.symptom_key = key;
      return true;
    })
    .map(({ row, idx }) => {
      const symptom_label =
        sanitizeText(row.symptom_label) ||
        row.symptom_key.replace(/_/g, " ");
      const category = sanitizeText(row.category) || "General";

      let risk_level = normalizeKey(row.risk_level || "medium");
      if (!VALID_RISK_LEVELS.includes(risk_level)) {
        warnings.push(
          `symptom_mappings[${idx}]: Invalid risk_level "${row.risk_level}", defaulting to "medium"`
        );
        risk_level = "medium";
      }

      let quote_strategy = normalizeKey(row.quote_strategy || "diagnostic_only");
      if (!VALID_QUOTE_STRATEGIES.includes(quote_strategy)) {
        warnings.push(
          `symptom_mappings[${idx}]: Invalid quote_strategy "${row.quote_strategy}", defaulting to "diagnostic_only"`
        );
        quote_strategy = "diagnostic_only";
      }

      return {
        symptom_key: row.symptom_key,
        symptom_label,
        category,
        required_skill_keys: dedupe(row.required_skill_keys),
        suggested_tool_keys: dedupe(row.suggested_tool_keys),
        required_safety_keys: dedupe(row.required_safety_keys),
        quote_strategy,
        risk_level,
        customer_explainer: sanitizeText(row.customer_explainer),
        mechanic_notes: sanitizeText(row.mechanic_notes),
      };
    });

  // ---- symptom_questions (MATCHES YOUR ACTUAL DB COLUMNS) ----
  const symptom_questions = raw.symptom_questions
    .map((row, idx) => ({ row, idx }))
    .filter(({ row, idx }) => {
      if (!row.symptom_key || !row.question_key) {
        warnings.push(
          `symptom_questions[${idx}]: Missing symptom_key or question_key, skipping`
        );
        return false;
      }

      row.symptom_key = normalizeKey(row.symptom_key);
      row.question_key = normalizeKey(row.question_key);

      const composite = `${row.symptom_key}::${row.question_key}`;
      if (seenQuestionComposite.has(composite)) {
        warnings.push(
          `symptom_questions[${idx}]: Duplicate (symptom_key, question_key) "${composite}", skipping`
        );
        return false;
      }
      seenQuestionComposite.add(composite);
      return true;
    })
    .map(({ row, idx }) => {
      // You might have question_label in JSON; DB wants question_text
      const question_text =
        sanitizeText(row.question_text) ||
        sanitizeText(row.question_label) ||
        row.question_key.replace(/_/g, " ");

      let question_type = normalizeKey(row.question_type || "yes_no");
      if (!VALID_QUESTION_TYPES.includes(question_type)) {
        warnings.push(
          `symptom_questions[${idx}]: Invalid question_type "${row.question_type}", defaulting to "yes_no"`
        );
        question_type = "yes_no";
      }

      const options = Array.isArray(row.options)
        ? row.options.map(sanitizeText).filter(Boolean)
        : [];

      // You might have order_index in JSON; DB wants display_order
      const display_order =
        Number.isFinite(parseInt(row.display_order, 10)) ||
        Number.isFinite(parseInt(row.order_index, 10))
          ? toInt(row.display_order ?? row.order_index, 10)
          : 10;

      return {
        symptom_key: row.symptom_key,
        question_key: row.question_key,
        question_text,
        question_type,
        options,
        affects_safety: toBool(row.affects_safety),
        affects_quote: toBool(row.affects_quote),
        display_order,
      };
    });

  return {
    valid: true,
    errors,
    warnings,
    data: { symptom_mappings, symptom_questions },
  };
}

// ---------- upserts ----------
async function upsertData(data) {
  console.log(`\nUpserting ${data.symptom_mappings.length} symptom_mappings...`);

  const { error: mappingsError } = await supabase
    .from("symptom_mappings")
    .upsert(data.symptom_mappings, { onConflict: "symptom_key" });

  if (mappingsError) {
    console.error("ERROR upserting symptom_mappings:", mappingsError);
    throw mappingsError;
  }
  console.log(`✓ Upserted ${data.symptom_mappings.length} symptom_mappings`);

  console.log(`\nUpserting ${data.symptom_questions.length} symptom_questions...`);

  const { error: questionsError } = await supabase
    .from("symptom_questions")
    // IMPORTANT: no spaces, must match UNIQUE(symptom_key, question_key)
    .upsert(data.symptom_questions, { onConflict: "symptom_key,question_key" });

  if (questionsError) {
    console.error("ERROR upserting symptom_questions:", questionsError);
    throw questionsError;
  }
  console.log(`✓ Upserted ${data.symptom_questions.length} symptom_questions`);
}

// ---------- main ----------
async function main() {
  console.log("=== Supabase Seed Script ===\n");

  // prefer data-fixed.json if present
  const fixedPath = path.join(__dirname, "data-fixed.json");
  const dataPath = fs.existsSync(fixedPath)
    ? fixedPath
    : path.join(__dirname, "data.json");

  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: ${dataPath} not found`);
    process.exit(1);
  }

  console.log(`Reading ${dataPath}...`);
  let rawContent = fs.readFileSync(dataPath, "utf8");

  // Strip BOM if present
  if (rawContent.charCodeAt(0) === 0xfeff) {
    console.log("Stripping BOM...");
    rawContent = rawContent.slice(1);
  }

  let rawData;
  try {
    rawData = JSON.parse(rawContent);
  } catch (e) {
    console.error("\nFATAL ERROR: data file is not valid JSON.");
    console.error(e);
    process.exit(1);
  }

  console.log("\nValidating and normalizing data...");
  const result = validateAndNormalize(rawData);

  if (!result.valid) {
    console.error("\nVALIDATION ERRORS:");
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn("\nWARNINGS:");
    result.warnings.forEach((warn) => console.warn(`  - ${warn}`));
  }

  console.log("\n✓ Validation passed");
  console.log(`  - ${result.data.symptom_mappings.length} symptom_mappings`);
  console.log(`  - ${result.data.symptom_questions.length} symptom_questions`);

  await upsertData(result.data);

  console.log("\n✓ Seeding complete");
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  process.exit(1);
});
