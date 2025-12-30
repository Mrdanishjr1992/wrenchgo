#!/usr/bin/env node

/**
 * Responsive Migration Helper Script
 * 
 * This script helps identify files that need responsive updates.
 * Run: node scripts/check-responsive.js
 */

const fs = require('fs');
const path = require('path');

const PATTERNS_TO_CHECK = [
  { pattern: /fontSize:\s*\d+(?!.*normalize)/, message: 'Hardcoded fontSize without normalize()' },
  { pattern: /width:\s*\d+(?!.*%|.*normalize)/, message: 'Fixed width without normalize() or percentage' },
  { pattern: /height:\s*\d+(?!.*%|.*normalize)/, message: 'Fixed height without normalize() or percentage' },
  { pattern: /padding:\s*\d+(?!.*spacing)/, message: 'Hardcoded padding (should use spacing)' },
  { pattern: /margin:\s*\d+(?!.*spacing)/, message: 'Hardcoded margin (should use spacing)' },
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    PATTERNS_TO_CHECK.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          line: index + 1,
          message,
          code: line.trim(),
        });
      }
    });
  });

  return issues;
}

function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanDirectory(filePath, results);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const issues = checkFile(filePath);
      if (issues.length > 0) {
        results.push({ file: filePath, issues });
      }
    }
  });

  return results;
}

console.log('🔍 Scanning for non-responsive patterns...\n');

const appDir = path.join(__dirname, '..', 'app');
const results = scanDirectory(appDir);

if (results.length === 0) {
  console.log('✅ All files are responsive!');
} else {
  console.log(`⚠️  Found ${results.length} files with potential issues:\n`);
  
  results.forEach(({ file, issues }) => {
    console.log(`📄 ${file}`);
    issues.slice(0, 5).forEach(({ line, message, code }) => {
      console.log(`   Line ${line}: ${message}`);
      console.log(`   ${code}\n`);
    });
    if (issues.length > 5) {
      console.log(`   ... and ${issues.length - 5} more issues\n`);
    }
  });

  console.log('\n💡 Tips:');
  console.log('   - Replace fontSize: X with fontSize: normalize(X)');
  console.log('   - Replace padding: X with padding: spacing.md (or xs/sm/lg/xl)');
  console.log('   - Replace fixed widths with flex: 1 or width: "100%"');
  console.log('   - Import normalize from "../../src/ui/theme"');
}
