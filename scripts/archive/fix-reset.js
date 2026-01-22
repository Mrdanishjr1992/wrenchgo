const fs = require('fs');
let c = fs.readFileSync('app/(auth)/reset-password.tsx', 'utf8');
c = c.replace(
  'export default function ResetPassword() {\n  const router = useRouter();',
  'export default function ResetPassword() {\n  const router = useRouter();\n  const { colors, text, spacing } = useTheme();'
);
fs.writeFileSync('app/(auth)/reset-password.tsx', c);
console.log('Done');
