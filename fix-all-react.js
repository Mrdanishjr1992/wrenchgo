const fs = require('fs');
const path = require('path');

// Get all tsx files recursively
function getAllTsxFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      files.push(...getAllTsxFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllTsxFiles('.');
let fixed = 0;

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('import React')) {
    c = 'import React from "react";\n' + c;
    fs.writeFileSync(f, c);
    console.log('Fixed:', f);
    fixed++;
  }
});
console.log(`Done. Fixed ${fixed} files.`);
