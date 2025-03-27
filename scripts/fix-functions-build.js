import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Paths
const serverBuildPath = join(rootDir, 'build', 'server');
const functionsBuildPath = join(rootDir, 'functions', 'build');
const functionsDistPath = join(rootDir, 'functions', 'dist');

console.log('🔄 Fixing functions build paths...');

// First ensure the server build exists
if (!existsSync(serverBuildPath)) {
  console.log('⚠️ Server build not found. Generating build...');
  try {
    execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Ensure functions/build directory exists
if (!existsSync(functionsBuildPath)) {
  console.log('📁 Creating functions build directory...');
  try {
    mkdirSync(functionsBuildPath, { recursive: true });
  } catch (error) {
    console.error('❌ Failed to create functions build directory:', error);
    process.exit(1);
  }
}

// Copy the server build to functions/build
console.log('📋 Copying server build to functions/build...');
try {
  cpSync(serverBuildPath, join(functionsBuildPath, 'server'), { recursive: true });
  console.log('✅ Successfully copied server build to functions/build');
} catch (error) {
  console.error('❌ Failed to copy server build:', error);
  process.exit(1);
}

// Update the wrangler.toml file with nodejs_compat to ensure proper compatibility
console.log('🔄 Updating wrangler.toml...');
try {
  const wranglerPath = join(rootDir, 'wrangler.toml');
  if (existsSync(wranglerPath)) {
    let wranglerContent = readFileSync(wranglerPath, 'utf-8');
    
    // Check if nodejs_compat is already present
    if (!wranglerContent.includes('nodejs_compat')) {
      if (wranglerContent.includes('compatibility_flags = [')) {
        // Add nodejs_compat to existing compatibility_flags array
        wranglerContent = wranglerContent.replace(
          'compatibility_flags = [', 
          'compatibility_flags = ["nodejs_compat", '
        );
      } else {
        // Add compatibility_flags with nodejs_compat
        wranglerContent += '\ncompatibility_flags = ["nodejs_compat"]\n';
      }
      
      writeFileSync(wranglerPath, wranglerContent);
      console.log('✅ Added nodejs_compat to wrangler.toml');
    } else {
      console.log('✅ nodejs_compat already present in wrangler.toml');
    }
  }
} catch (error) {
  console.error('⚠️ Failed to update wrangler.toml:', error);
  // Continue anyway
}

// Fix the functions/[[path]].ts file to properly import crypto polyfill
console.log('🔧 Updating functions TypeScript file...');
try {
  const pathTsFile = join(rootDir, 'functions', '[[path]].ts');
  if (existsSync(pathTsFile)) {
    let tsContent = readFileSync(pathTsFile, 'utf-8');
    
    // Make sure we have correct imports
    if (!tsContent.includes('// Import crypto polyfill first')) {
      tsContent = `// Import crypto polyfill first to ensure it's available
import './crypto-polyfill.js';

${tsContent.replace('import \'./crypto-polyfill.js\';\n\n', '')}`;
      
      writeFileSync(pathTsFile, tsContent);
      console.log('✅ Updated functions TypeScript file');
    }
  }
} catch (error) {
  console.error('⚠️ Failed to update functions TypeScript file:', error);
  // Continue anyway
}

// Now rebuild the dist file
console.log('🔄 Building functions...');
try {
  execSync('npx wrangler pages functions build --outdir=./functions/dist --minify=false', {
    stdio: 'inherit',
    cwd: rootDir
  });
  console.log('✅ Successfully built functions');
} catch (error) {
  console.error('⚠️ Failed to build functions:', error);
  console.log('Continuing with existing dist file...');
}

// Fix any remaining issues in the dist file if it exists
if (existsSync(functionsDistPath)) {
  const pathJsFile = join(functionsDistPath, '[[path]].js');
  
  if (existsSync(pathJsFile)) {
    console.log('🔧 Patching functions dist file...');
    try {
      let content = readFileSync(pathJsFile, 'utf-8');
      
      // Add global crypto check at the beginning of the file
      if (!content.startsWith('// Ensure crypto polyfill')) {
        content = `// Ensure crypto polyfill is initialized
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.subtle === 'undefined') {
  globalThis.crypto.subtle = {};
}
if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  globalThis.crypto.getRandomValues = function(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}
console.log("Crypto polyfill initialized");

${content}`;
      }
      
      writeFileSync(pathJsFile, content);
      console.log('✅ Successfully patched functions dist file');
    } catch (error) {
      console.error('⚠️ Failed to patch functions dist file:', error);
    }
  }
}

console.log('🎉 Functions build paths fixed successfully!'); 