import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');

const REQUIRED_FILES = [
  'index.html',
  'manifest.json',
  'sw.js',
  'firebase-messaging-sw.js',
  'server.cjs'
];

console.log('🔍 Starting post-build validation...');
console.log(`📂 Checking build directory: ${DIST_DIR}\n`);

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Error: dist folder does not exist! Build failed.');
  process.exit(1);
}

let hasError = false;

console.log('--- Checking Required Root Artifacts ---');
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(DIST_DIR, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ [FOUND]   ${file.padEnd(28)} | Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.error(`❌ [MISSING] ${file.padEnd(28)} is missing from the build output!`);
    hasError = true;
  }
});

console.log('\n--- Checking Bundled Assets ---');
const assetsDir = path.join(DIST_DIR, 'assets');
if (fs.existsSync(assetsDir)) {
  const assets = fs.readdirSync(assetsDir);
  const jsFiles = assets.filter(f => f.endsWith('.js'));
  const cssFiles = assets.filter(f => f.endsWith('.css'));
  console.log(`✅ [ASSETS]  Found ${assets.length} total asset files inside dist/assets:`);
  console.log(`             ├─ JS Files:  ${jsFiles.length}`);
  console.log(`             └─ CSS Files: ${cssFiles.length}`);
  
  if (jsFiles.length === 0) {
    console.error('❌ Error: No compiled JS bundle detected in dist/assets!');
    hasError = true;
  }
  if (cssFiles.length === 0) {
    console.warn('⚠️ Warning: No compiled CSS assets detected in dist/assets.');
  }
} else {
  console.error('❌ Error: dist/assets directory is completely missing!');
  hasError = true;
}

console.log('\n--- Validation Result ---');
if (hasError) {
  console.error('❌ Post-build validation failed! Deferring artifact delivery.');
  process.exit(1);
} else {
  console.log('✨ Post-build validation passed! All critical deployment artifacts are present, complete, and valid.');
}
