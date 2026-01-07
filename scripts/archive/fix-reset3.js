const fs = require('fs');
let c = fs.readFileSync('app/(auth)/reset-password.tsx', 'utf8');
c = c.replace(
  `export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");`,
  `export default function ResetPassword() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const [password, setPassword] = useState("");`
);
fs.writeFileSync('app/(auth)/reset-password.tsx', c);
console.log('Done');
