const fs = require('fs');
let c = fs.readFileSync('app/(auth)/reset-password.tsx', 'utf8');
c = c.replace(
  'const router = useRouter();\n  const [password',
  'const router = useRouter();\n  const { colors, text, spacing } = useTheme();\n  const [password'
);
fs.writeFileSync('app/(auth)/reset-password.tsx', c);
console.log('Done');
