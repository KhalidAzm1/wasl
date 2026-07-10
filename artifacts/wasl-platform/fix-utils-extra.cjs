const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'utils.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/text-emerald-400/g, 'text-emerald-600 dark:text-emerald-400');
content = content.replace(/text-red-400/g, 'text-red-600 dark:text-red-400');
content = content.replace(/text-yellow-400/g, 'text-yellow-600 dark:text-yellow-400');
content = content.replace(/bg-emerald-400/g, 'bg-emerald-600 dark:bg-emerald-400');
content = content.replace(/bg-red-400/g, 'bg-red-600 dark:bg-red-400');
content = content.replace(/bg-yellow-400/g, 'bg-yellow-600 dark:bg-yellow-400');

// Slate-300 to muted-foreground logic
content = content.replace(/text-slate-300/g, 'text-muted-foreground');
content = content.replace(/bg-slate-300/g, 'bg-muted-foreground');

fs.writeFileSync(filePath, content);
