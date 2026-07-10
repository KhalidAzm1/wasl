const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'utils.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Update getStatusColor hardcoded values to be theme-aware or use specific utility classes
// Wait, the utility classes from Tailwind are fine if they are generic, but let's check what it is.
content = content.replace(/text-white/g, 'text-foreground');
content = content.replace(/bg-white/g, 'bg-foreground');

fs.writeFileSync(filePath, content);
