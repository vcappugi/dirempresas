const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const outDir = path.join(__dirname, 'www');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const copyRecursive = (src, dest) => {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const itemsToCopy = [
  'index.html',
  'login.html',
  'manifest.json',
  '.env',
  'css',
  'js',
  'images',
  'templates'
];

itemsToCopy.forEach(item => {
  const itemPath = path.join(srcDir, item);
  if (fs.existsSync(itemPath)) {
    copyRecursive(itemPath, path.join(outDir, item));
    console.log(`Copied ${item} -> www/${item}`);
  }
});

console.log('Build complete! Distribution folder prepared in www/');
