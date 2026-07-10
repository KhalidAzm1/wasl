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

  // Glass and neutral colors
  content = content.replace(/text-white\/(\d+)/g, 'text-foreground/$1');
  content = content.replace(/text-white(?!\/)/g, 'text-foreground');
  content = content.replace(/bg-white\/(\d+)/g, 'bg-foreground/$1');
  content = content.replace(/border-white\/(\d+)/g, 'border-foreground/$1');
  content = content.replace(/border-white(?!\/)/g, 'border-border');

  // Hardcoded dashboard cyan to primary brand violet
  content = content.replace(/text-\[#00e5ff\]\/(\d+)/g, 'text-primary/$1');
  content = content.replace(/text-\[#00e5ff\](?!\/)/g, 'text-primary');
  content = content.replace(/bg-\[#00e5ff\]\/(\d+)/g, 'bg-primary/$1');
  content = content.replace(/bg-\[#00e5ff\](?!\/)/g, 'bg-primary');
  content = content.replace(/border-\[#00e5ff\]\/(\d+)/g, 'border-primary/$1');
  content = content.replace(/border-\[#00e5ff\](?!\/)/g, 'border-primary');
  content = content.replace(/ring-\[#00e5ff\]\/(\d+)/g, 'ring-primary/$1');
  content = content.replace(/ring-\[#00e5ff\](?!\/)/g, 'ring-primary');

  // Hex colors
  content = content.replace(/bg-\[#050816\]\/(\d+)/g, 'bg-background/$1');
  content = content.replace(/bg-\[#050816\](?!\/)/g, 'bg-background');
  
  // Specific shadows
  content = content.replace(/rgba\(0,229,255/g, 'rgba(79,50,214'); // approximated primary rgb

  // Black backgrounds for overlay -> background
  content = content.replace(/bg-black\/60/g, 'bg-background/80');
  content = content.replace(/bg-black\/40/g, 'bg-background/60');
  content = content.replace(/bg-black\/20/g, 'bg-foreground/5');

  // Text-black to primary-foreground depending on context
  content = content.replace(/text-black(?!\/)/g, 'text-primary-foreground');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
});
