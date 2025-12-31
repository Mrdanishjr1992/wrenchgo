const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_QUOTE_STRATEGIES = ['diagnostic_only', 'fixed_simple', 'inspection_required'];
const VALID_QUESTION_TYPES = ['yes_no', 'single_choice', 'multi_choice', 'numeric', 'photo', 'audio'];

function validateAndNormalize(data) {
  const errors = [];
  const warnings = [];

  if (!data.symptom_mappings || !Array.isArray(data.symptom_mappings)) {
    errors.push('Missing or invalid symptom_mappings array');
  }
  if (!data.symptom_questions || !Array.isArray(data.symptom_questions)) {
    errors.push('Missing or invalid symptom_questions array');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const seenSymptomKeys = new Set();
  const seenQuestionKeys = new Set();

  data.symptom_mappings = data.symptom_mappings.filter((row, idx) => {
    if (!row.symptom_key || typeof row.symptom_key !== 'string') {
      warnings.push(`symptom_mappings[${idx}]: Missing symptom_key, skipping`);
      return false;
    }

    row.symptom_key = row.symptom_key.trim().toLowerCase();

    if (seenSymptomKeys.has(row.symptom_key)) {
      warnings.push(`symptom_mappings[${idx}]: Duplicate symptom_key "${row.symptom_key}", skipping`);
      return false;
    }
    seenSymptomKeys.add(row.symptom_key);

    if (!row.symptom_label) row.symptom_label = row.symptom_key.replace(/_/g, ' ');
    if (!row.category) row.category = 'General';
    if (!row.customer_explainer) row.customer_explainer = '';
    if (!row.mechanic_notes) row.mechanic_notes = '';

    row.symptom_label = row.symptom_label.trim();
    row.category = row.category.trim();
    row.customer_explainer = row.customer_explainer.trim();
    row.mechanic_notes = row.mechanic_notes.trim();

    if (!Array.isArray(row.required_skill_keys)) row.required_skill_keys = [];
    if (!Array.isArray(row.suggested_tool_keys)) row.suggested_tool_keys = [];
    if (!Array.isArray(row.required_safety_keys)) row.required_safety_keys = [];

    row.required_skill_keys = [...new Set(row.required_skill_keys.filter(Boolean))];
    row.suggested_tool_keys = [...new Set(row.suggested_tool_keys.filter(Boolean))];
    row.required_safety_keys = [...new Set(row.required_safety_keys.filter(Boolean))];

    if (!VALID_RISK_LEVELS.includes(row.risk_level)) {
      warnings.push(`symptom_mappings[${idx}]: Invalid risk_level "${row.risk_level}", defaulting to "medium"`);
      row.risk_level = 'medium';
    }

    if (!VALID_QUOTE_STRATEGIES.includes(row.quote_strategy)) {
      warnings.push(`symptom_mappings[${idx}]: Invalid quote_strategy "${row.quote_strategy}", defaulting to "diagnostic_only"`);
      row.quote_strategy = 'diagnostic_only';
    }

    return true;
  });

  data.symptom_questions = data.symptom_questions.filter((row, idx) => {
    if (!row.symptom_key || !row.question_key) {
      warnings.push(`symptom_questions[${idx}]: Missing symptom_key or question_key, skipping`);
      return false;
    }

    row.symptom_key = row.symptom_key.trim().toLowerCase();
    row.question_key = row.question_key.trim().toLowerCase();

    const compositeKey = `${row.symptom_key}::${row.question_key}`;
    if (seenQuestionKeys.has(compositeKey)) {
      warnings.push(`symptom_questions[${idx}]: Duplicate (symptom_key, question_key) "${compositeKey}", skipping`);
      return false;
    }
    seenQuestionKeys.add(compositeKey);

    if (!row.question_label) row.question_label = row.question_key.replace(/_/g, ' ');
    if (!row.helps_mechanic_with) row.helps_mechanic_with = '';

    row.question_label = row.question_label.trim();
    row.helps_mechanic_with = row.helps_mechanic_with.trim();

    if (!VALID_QUESTION_TYPES.includes(row.question_type)) {
      warnings.push(`symptom_questions[${idx}]: Invalid question_type "${row.question_type}", defaulting to "yes_no"`);
      row.question_type = 'yes_no';
    }

    if (!Array.isArray(row.options)) row.options = [];
    row.options = row.options.filter(Boolean);

    row.affects_quote = Boolean(row.affects_quote);
    row.affects_safety = Boolean(row.affects_safety);
    row.affects_tools = Boolean(row.affects_tools);
    row.order_index = parseInt(row.order_index) || 10;

    return true;
  });

  return { valid: true, errors, warnings, data };
}

async function upsertData(data) {
  console.log(`\nUpserting ${data.symptom_mappings.length} symptom_mappings...`);
  
  const { data: mappingsResult, error: mappingsError } = await supabase
    .from('symptom_mappings')
    .upsert(data.symptom_mappings, { onConflict: 'symptom_key' });

  if (mappingsError) {
    console.error('ERROR upserting symptom_mappings:', mappingsError);
    throw mappingsError;
  }

  console.log(`✓ Upserted ${data.symptom_mappings.length} symptom_mappings`);

  console.log(`\nUpserting ${data.symptom_questions.length} symptom_questions...`);

  const { data: questionsResult, error: questionsError } = await supabase
    .from('symptom_questions')
    .upsert(data.symptom_questions, { onConflict: 'symptom_key,question_key' });

  if (questionsError) {
    console.error('ERROR upserting symptom_questions:', questionsError);
    throw questionsError;
  }

  console.log(`✓ Upserted ${data.symptom_questions.length} symptom_questions`);
}

async function main() {
  console.log('=== Supabase Seed Script ===\n');

  const dataPath = path.join(__dirname, 'data.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: ${dataPath} not found`);
    process.exit(1);
  }

  console.log(`Reading ${dataPath}...`);
  let rawContent = fs.readFileSync(dataPath, 'utf8');

  // Strip BOM if present
  if (rawContent.charCodeAt(0) === 0xFEFF) {
    console.log('Stripping BOM...');
    rawContent = rawContent.slice(1);
  }

  const rawData = JSON.parse(rawContent);

  console.log('\nValidating and normalizing data...');
  const result = validateAndNormalize(rawData);

  if (!result.valid) {
    console.error('\nVALIDATION ERRORS:');
    result.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\nWARNINGS:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  console.log('\n✓ Validation passed');
  console.log(`  - ${result.data.symptom_mappings.length} symptom_mappings`);
  console.log(`  - ${result.data.symptom_questions.length} symptom_questions`);

  await upsertData(result.data);

  console.log('\n✓ Seeding complete');
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
