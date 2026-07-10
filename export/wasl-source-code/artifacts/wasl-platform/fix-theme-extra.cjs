const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walk(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

const ignoreFiles = ['entry-experience.tsx', 'index.css', 'ThemeProvider.tsx', 'utils.ts'];

walk(srcDir, (filePath) => {
  if (ignoreFiles.some(ignore => filePath.includes(ignore))) return;
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Let's replace any text-red-400 with text-destructive for theme awareness
  // but status colors might need preserving. Let's see if we can generalize them to theme variables or keep them since they are often used for "bad" vs "good" semantic coloring which looks fine in both if the background is light or dark.
  // Actually, yellow-400, emerald-400, red-400 might look bad on light mode (white text-ish).
  content = content.replace(/text-emerald-400/g, 'text-emerald-600 dark:text-emerald-400');
  content = content.replace(/text-red-400/g, 'text-red-600 dark:text-red-400');
  content = content.replace(/text-yellow-400/g, 'text-yellow-600 dark:text-yellow-400');
  content = content.replace(/bg-red-400/g, 'bg-red-600 dark:bg-red-400');
  content = content.replace(/bg-emerald-400/g, 'bg-emerald-600 dark:bg-emerald-400');
  content = content.replace(/bg-yellow-400/g, 'bg-yellow-600 dark:bg-yellow-400');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated colors ${filePath}`);
  }
});
