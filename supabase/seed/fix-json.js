const fs = require('fs');

// Read and strip BOM
let content = fs.readFileSync('supabase/seed/data.json', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

// Parse and validate
try {
  const data = JSON.parse(content);
  console.log('✓ JSON is valid');
  console.log(`  - ${data.symptom_mappings.length} symptom_mappings`);
  console.log(`  - ${data.symptom_questions.length} symptom_questions`);
  
  // Write clean version
  fs.writeFileSync('supabase/seed/data.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('\n✓ Cleaned and saved data.json');
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
