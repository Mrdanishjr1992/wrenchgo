const fs = require('fs');
let c = fs.readFileSync('src/ui/theme.ts', 'utf8');
// Change accent from teal to blue
c = c.replace('accent: "#14B8A6"', 'accent: "#3B82F6"');
c = c.replace('accent: "#5EEAD4"', 'accent: "#60A5FA"');
fs.writeFileSync('src/ui/theme.ts', c);
console.log('Done');
