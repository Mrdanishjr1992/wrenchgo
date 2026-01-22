#!/usr/bin/env node

/**
 * Dark Mode Color Audit Script
 * 
 * Scans the codebase for hardcoded #000, #fff, #000000, #ffffff
 * and suggests theme-aware replacements.
 * 
 * Usage: node scripts/audit-colors.js
 */

const fs = require('fs');
const path = require('path');

const HARDCODED_COLORS = [
  { pattern: /#000000|#000\b/g, name: 'black', suggestion: 'colors.textPrimary or colors.bg' },
  { pattern: /#ffffff|#fff\b/gi, name: 'white', suggestion: 'colors.textPrimary or buttonTextColor' },
  { pattern: /rgba\(0,\s*0,\s*0/g, name: 'black rgba', suggestion: 'colors.overlay or withAlpha(colors.textPrimary, alpha)' },
  { pattern: /rgba\(255,\s*255,\s*255/g, name: 'white rgba', suggestion: 'withAlpha(colors.textPrimary, alpha)' },
];

const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.expo/,
  /dist/,
  /build/,
  /\.md$/,
  /package\.json$/,
  /package-lock\.json$/,
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    HARDCODED_COLORS.forEach(({ pattern, name, suggestion }) => {
      const matches = line.match(pattern);
      if (matches) {
        issues.push({
          file: filePath,
          line: index + 1,
          color: name,
          code: line.trim(),
          suggestion,
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
    
    if (shouldIgnore(filePath)) return;

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDirectory(filePath, results);
    } else if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      const issues = scanFile(filePath);
      results.push(...issues);
    }
  });

  return results;
}

function groupByFile(issues) {
  const grouped = {};
  issues.forEach(issue => {
    if (!grouped[issue.file]) {
      grouped[issue.file] = [];
    }
    grouped[issue.file].push(issue);
  });
  return grouped;
}

function generateReport(issues) {
  console.log('\n🎨 Dark Mode Color Audit Report\n');
  console.log(`Found ${issues.length} hardcoded color instances\n`);

  const grouped = groupByFile(issues);
  const files = Object.keys(grouped).sort();

  files.forEach(file => {
    console.log(`\n📄 ${file}`);
    grouped[file].forEach(issue => {
      console.log(`   Line ${issue.line}: ${issue.color}`);
      console.log(`   Code: ${issue.code}`);
      console.log(`   💡 Suggestion: ${issue.suggestion}`);
      console.log('');
    });
  });

  console.log('\n📊 Summary by Color Type:\n');
  const colorCounts = {};
  issues.forEach(issue => {
    colorCounts[issue.color] = (colorCounts[issue.color] || 0) + 1;
  });
  Object.entries(colorCounts).forEach(([color, count]) => {
    console.log(`   ${color}: ${count} instances`);
  });

  console.log('\n✅ Next Steps:\n');
  console.log('   1. Review each instance in context');
  console.log('   2. Replace with appropriate theme token');
  console.log('   3. Test in both light and dark modes');
  console.log('   4. Run this script again to verify\n');
}

// Run the audit
const rootDir = process.cwd();
const issues = scanDirectory(rootDir);
generateReport(issues);

// Exit with error code if issues found
process.exit(issues.length > 0 ? 1 : 0);
