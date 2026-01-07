const fs = require('fs');
let content = fs.readFileSync('app/(customer)/(tabs)/account.tsx', 'utf8');

const oldText = `<Image source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />`;
const newText = `<Image key={profile.avatar_url} source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />`;

content = content.replace(oldText, newText);
fs.writeFileSync('app/(customer)/(tabs)/account.tsx', content);
console.log('Done');
