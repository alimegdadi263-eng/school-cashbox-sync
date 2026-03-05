/**
 * Post-build script: generates SHA-256 hashes of all JS/CSS files in dist/assets/
 * The hash manifest is used at runtime by main.cjs to detect file tampering.
 * Run AFTER obfuscation, BEFORE electron-builder.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST_DIR = path.join(__dirname, '../../dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const OUTPUT_FILE = path.join(DIST_DIR, '.integrity.json');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateManifest() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('dist/assets not found. Run build + obfuscate first.');
    process.exit(1);
  }

  const manifest = {};
  const files = fs.readdirSync(ASSETS_DIR).filter(f => /\.(js|css)$/.test(f));

  console.log(`Generating integrity hashes for ${files.length} files...`);

  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    manifest[`assets/${file}`] = hashFile(filePath);
    console.log(`  ✓ ${file}`);
  }

  // Also hash index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    manifest['index.html'] = hashFile(indexPath);
    console.log('  ✓ index.html');
  }

  // Sign the manifest itself with a timestamp
  const manifestData = {
    files: manifest,
    generatedAt: new Date().toISOString(),
    fileCount: Object.keys(manifest).length,
  };

  // Create a signature of the manifest content
  const manifestString = JSON.stringify(manifestData.files) + manifestData.generatedAt;
  manifestData.signature = crypto.createHash('sha256').update(manifestString).digest('hex');

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifestData, null, 2));
  console.log(`\nIntegrity manifest written to ${OUTPUT_FILE}`);
  console.log(`Total files: ${manifestData.fileCount}`);
}

generateManifest();
