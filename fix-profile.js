const fs = require('fs');
let c = fs.readFileSync('components/profile/UserProfileCardQuotes.tsx', 'utf8');
c = c.replace(
  `interface UserProfileCardProps {
  userId: string;
  variant?: ProfileCardVariant;
  showActions?: boolean;`,
  `interface UserProfileCardProps {
  userId: string;
  variant?: ProfileCardVariant;
  context?: string;
  showActions?: boolean;`
);
c = c.replace(
  `export function UserProfileCard({
  userId,
  variant = 'mini',
  showActions = false,`,
  `export function UserProfileCard({
  userId,
  variant = 'mini',
  context,
  showActions = false,`
);
fs.writeFileSync('components/profile/UserProfileCardQuotes.tsx', c);
console.log('Done');
