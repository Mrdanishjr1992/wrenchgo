const fs = require('fs');
const files = [
  'app/(app)/jobs/[jobId]/completion.tsx',
  'app/(app)/jobs/[jobId]/invoice.tsx',
  'app/(app)/jobs/[jobId]/payment-processing.tsx',
  'app/(app)/jobs/[jobId]/payment.tsx',
  'app/(app)/mechanic/onboarding.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('import React')) {
    c = 'import React from "react";\n' + c;
    fs.writeFileSync(f, c);
    console.log('Fixed:', f);
  }
});
console.log('Done');
