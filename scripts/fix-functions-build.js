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

// Create a Node.js polyfill module for common Node.js built-ins
console.log('🔧 Creating Node.js polyfill module...');
try {
  const nodePolyfillPath = join(rootDir, 'functions', 'node-polyfills.js');
  const nodePolyfillContent = `// Polyfills for Node.js built-in modules in Cloudflare Workers
// Import this file at the top of your entry point

// Crypto is handled in crypto-polyfill.js

// Stream polyfill
if (typeof globalThis.stream === 'undefined') {
  globalThis.stream = {
    Transform: class Transform {
      constructor() {
        console.warn('Using stream.Transform polyfill');
      }
      _transform() {}
      _flush() {}
      pipe() { return this; }
    }
  };
}

// Process polyfill
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    nextTick: (fn) => setTimeout(fn, 0),
    version: '',
    versions: { node: '16.0.0' }
  };
}

// Events polyfill
if (typeof globalThis.events === 'undefined') {
  class EventEmitter {
    constructor() {
      this._events = {};
    }
    on(event, listener) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
      return this;
    }
    emit(event, ...args) {
      if (!this._events[event]) return false;
      this._events[event].forEach(listener => listener(...args));
      return true;
    }
    removeListener(event, listener) {
      if (!this._events[event]) return this;
      this._events[event] = this._events[event].filter(l => l !== listener);
      return this;
    }
  }
  globalThis.events = {
    EventEmitter
  };
}

// Add global Buffer if needed
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from: (data, encoding) => {
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        return encoder.encode(data);
      }
      return new Uint8Array(data);
    },
    isBuffer: (obj) => obj instanceof Uint8Array,
    alloc: (size) => new Uint8Array(size)
  };
}

console.log('✅ Node.js polyfills initialized');
`;

  writeFileSync(nodePolyfillPath, nodePolyfillContent);
  console.log('✅ Created Node.js polyfill module');
  
  // Update the [[path]].ts to import the Node.js polyfills
  const pathTsFile = join(rootDir, 'functions', '[[path]].ts');
  if (existsSync(pathTsFile)) {
    let tsContent = readFileSync(pathTsFile, 'utf-8');
    
    // Add Node.js polyfills import if not already present
    if (!tsContent.includes('import \'./node-polyfills.js\'')) {
      tsContent = tsContent.replace(
        'import \'./crypto-polyfill.js\';', 
        'import \'./crypto-polyfill.js\';\n// Import Node.js polyfills\nimport \'./node-polyfills.js\';'
      );
      
      writeFileSync(pathTsFile, tsContent);
      console.log('✅ Updated functions TypeScript file with Node.js polyfills import');
    }
  }
} catch (error) {
  console.error('⚠️ Failed to create Node.js polyfill module:', error);
  // Continue anyway
}

// Now rebuild the dist file
console.log('🔄 Building functions...');
try {
  execSync('npx wrangler pages functions build --outdir=./functions/dist --minify=false --compatibility-flags nodejs_compat --compatibility-date 2024-09-23', {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096 --no-warnings' } // Suppress Node.js warnings
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
      
      // Add global polyfills at the beginning of the file
      if (!content.startsWith('// Ensure polyfills are initialized')) {
        content = `// Ensure polyfills are initialized
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

// Node.js built-in module polyfills
if (typeof globalThis.stream === 'undefined') {
  globalThis.stream = { Transform: class {} };
}
if (typeof globalThis.process === 'undefined') {
  globalThis.process = { env: {}, nextTick: (fn) => setTimeout(fn, 0) };
}
if (typeof globalThis.events === 'undefined') {
  globalThis.events = { EventEmitter: class {} };
}
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = { from: () => new Uint8Array(), isBuffer: () => false };
}

console.log("Polyfills initialized");

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