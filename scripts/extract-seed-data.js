/**
 * Extract Seed Data from JSON to SQL
 * 
 * Reads data-fixed.json and generates SQL INSERT statements
 * for use in supabase/migrations/20250127000005_seed_data.sql
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../supabase/seed/data-fixed.json');
const OUTPUT_FILE = path.join(__dirname, '../supabase/seed-archive/extracted-seed-data.sql');

function escapeSQL(str) {
  if (str == null) return 'NULL';
  if (typeof str === 'boolean') return str ? 'true' : 'false';
  if (typeof str === 'number') return str.toString();
  if (Array.isArray(str)) return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
  if (typeof str === 'object') return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
  return `'${String(str).replace(/'/g, "''")}'`;
}

function generateSymptomMappingsSQL(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return '-- No symptom_mappings data found\n';
  }

  let sql = `-- =====================================================
-- SYMPTOM_MAPPINGS (${mappings.length} rows)
-- =====================================================
-- Source: data-fixed.json (validated production data)
-- Purpose: Links symptoms to skills, tools, safety requirements, and quote strategies

INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  symptom_icon,
  risk_level,
  quote_strategy,
  required_skills,
  required_tools,
  required_safety,
  created_at
) VALUES\n`;

  const values = mappings.map((row, idx) => {
    const parts = [
      escapeSQL(row.symptom_key),
      escapeSQL(row.symptom_label),
      escapeSQL(row.symptom_icon),
      escapeSQL(row.risk_level),
      escapeSQL(row.quote_strategy),
      escapeSQL(row.required_skills),
      escapeSQL(row.required_tools),
      escapeSQL(row.required_safety),
      'NOW()'
    ];
    const isLast = idx === mappings.length - 1;
    return `  (${parts.join(', ')})${isLast ? '' : ','}`;
  });

  sql += values.join('\n');
  sql += '\nON CONFLICT (symptom_key) DO NOTHING;\n\n';

  return sql;
}

function generateSymptomQuestionsSQL(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return '-- No symptom_questions data found\n';
  }

  let sql = `-- =====================================================
-- SYMPTOM_QUESTIONS (${questions.length} rows)
-- =====================================================
-- Source: data-fixed.json (validated production data)
-- Purpose: Follow-up questions for symptom diagnosis

INSERT INTO public.symptom_questions (
  symptom_key,
  question_key,
  question_text,
  question_type,
  options,
  affects_safety,
  affects_quote,
  affects_tools,
  display_order,
  created_at
) VALUES\n`;

  const values = questions.map((row, idx) => {
    const parts = [
      escapeSQL(row.symptom_key),
      escapeSQL(row.question_key),
      escapeSQL(row.question_text),
      escapeSQL(row.question_type),
      escapeSQL(row.options),
      escapeSQL(row.affects_safety),
      escapeSQL(row.affects_quote),
      escapeSQL(row.affects_tools),
      escapeSQL(row.display_order || 10),
      'NOW()'
    ];
    const isLast = idx === questions.length - 1;
    return `  (${parts.join(', ')})${isLast ? '' : ','}`;
  });

  sql += values.join('\n');
  sql += '\nON CONFLICT (symptom_key, question_key) DO NOTHING;\n\n';

  return sql;
}

function generateSymptomsSQL(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return '-- No symptoms data found\n';
  }

  const uniqueSymptoms = new Map();
  mappings.forEach(row => {
    if (row.symptom_key && !uniqueSymptoms.has(row.symptom_key)) {
      uniqueSymptoms.set(row.symptom_key, {
        key: row.symptom_key,
        label: row.symptom_label || row.symptom_key.replace(/_/g, ' '),
        icon: row.symptom_icon || '🔧'
      });
    }
  });

  const symptoms = Array.from(uniqueSymptoms.values());

  let sql = `-- =====================================================
-- SYMPTOMS (${symptoms.length} rows)
-- =====================================================
-- Source: Extracted from symptom_mappings in data-fixed.json
-- Purpose: Master symptom list for diagnosis feature

INSERT INTO public.symptoms (key, label, icon, created_at) VALUES\n`;

  const values = symptoms.map((row, idx) => {
    const parts = [
      escapeSQL(row.key),
      escapeSQL(row.label),
      escapeSQL(row.icon),
      'NOW()'
    ];
    const isLast = idx === symptoms.length - 1;
    return `  (${parts.join(', ')})${isLast ? '' : ','}`;
  });

  sql += values.join('\n');
  sql += '\nON CONFLICT (key) DO NOTHING;\n\n';

  return sql;
}

function main() {
  console.log('🔍 Reading data-fixed.json...');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  const data = JSON.parse(rawData);

  console.log('✅ JSON parsed successfully');
  console.log(`   - symptom_mappings: ${data.symptom_mappings?.length || 0} rows`);
  console.log(`   - symptom_questions: ${data.symptom_questions?.length || 0} rows`);

  console.log('\n📝 Generating SQL...');

  let sql = `-- =====================================================
-- EXTRACTED SEED DATA FROM data-fixed.json
-- =====================================================
-- Generated: ${new Date().toISOString()}
-- Source: supabase/seed/data-fixed.json
-- Purpose: Production seed data for symptom diagnosis feature
--
-- INSTRUCTIONS:
-- 1. Copy the sections below into:
--    supabase/migrations/20250127000005_seed_data.sql
-- 2. Replace the TODO placeholders
-- 3. Test with: supabase db reset
-- 4. Deploy with: supabase db push
-- =====================================================

`;

  sql += generateSymptomsSQL(data.symptom_mappings);
  sql += generateSymptomMappingsSQL(data.symptom_mappings);
  sql += generateSymptomQuestionsSQL(data.symptom_questions);

  sql += `-- =====================================================
-- END OF EXTRACTED DATA
-- =====================================================
-- Next steps:
-- 1. Review the SQL above
-- 2. Copy into seed data migration
-- 3. Test with db reset
-- 4. Deploy to production
-- =====================================================
`;

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');

  console.log('✅ SQL generated successfully');
  console.log(`   Output: ${OUTPUT_FILE}`);
  console.log(`   Size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log('\n📋 Next steps:');
  console.log('   1. Review the generated SQL');
  console.log('   2. Copy into supabase/migrations/20250127000005_seed_data.sql');
  console.log('   3. Test with: supabase db reset');
  console.log('   4. Deploy with: supabase db push');
}

try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
