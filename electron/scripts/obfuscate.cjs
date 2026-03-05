/**
 * Post-build script to obfuscate the bundled JS files in dist/assets/
 * Run after `vite build` and before `electron-builder`
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const DIST_ASSETS = path.join(__dirname, '../../dist/assets');

function obfuscateFiles() {
  if (!fs.existsSync(DIST_ASSETS)) {
    console.error('dist/assets not found. Run vite build first.');
    process.exit(1);
  }

  const jsFiles = fs.readdirSync(DIST_ASSETS).filter(f => f.endsWith('.js'));

  console.log(`Obfuscating ${jsFiles.length} JS files...`);

  for (const file of jsFiles) {
    const filePath = path.join(DIST_ASSETS, file);
    const code = fs.readFileSync(filePath, 'utf8');

    const result = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.2,
      debugProtection: true,
      debugProtectionInterval: 2000,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ['base64'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    });

    fs.writeFileSync(filePath, result.getObfuscatedCode());
    console.log(`  ✓ ${file}`);
  }

  console.log('Obfuscation complete.');
}

obfuscateFiles();
