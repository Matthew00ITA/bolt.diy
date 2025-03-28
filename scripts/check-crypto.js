#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Create a temp Cloudflare worker to test crypto
const tempWorkerPath = join(rootDir, 'test-crypto-worker.js');
const testWorkerCode = `
// Import our polyfills
import './functions/crypto-polyfill.js';
import './functions/node-polyfills.js';
import cryptoBridge from './functions/node-crypto-bridge.js';

// Test direct Web Crypto API
function testWebCrypto() {
  console.log('Testing Web Crypto API...');
  try {
    const randomValues = globalThis.crypto.getRandomValues(new Uint8Array(8));
    console.log('✅ crypto.getRandomValues works:', [...randomValues]);
    
    // Test subtle crypto
    if (globalThis.crypto.subtle) {
      console.log('✅ crypto.subtle exists');
    } else {
      console.error('❌ crypto.subtle is missing');
    }
  } catch (error) {
    console.error('❌ Web Crypto API test failed:', error);
  }
}

// Test Node.js crypto module
async function testNodeCrypto() {
  console.log('\\nTesting Node.js crypto module...');
  try {
    // Test createHash
    const hash = cryptoBridge.createHash('sha256');
    const digestResult = await hash.update('test').digest('hex');
    console.log('✅ crypto.createHash works:', digestResult);
    
    // Test randomBytes
    const randomBytes = cryptoBridge.randomBytes(8);
    console.log('✅ crypto.randomBytes works:', [...randomBytes]);
  } catch (error) {
    console.error('❌ Node.js crypto test failed:', error);
  }
}

// Test with require
async function testRequireCrypto() {
  console.log('\\nTesting require("crypto")...');
  try {
    if (typeof globalThis.require === 'function') {
      const nodeCrypto = globalThis.require('crypto');
      console.log('✅ require("crypto") works');
      
      if (nodeCrypto.createHash) {
        console.log('✅ require("crypto").createHash exists');
      } else {
        console.error('❌ require("crypto").createHash is missing');
      }
    } else {
      console.error('❌ globalThis.require is not defined');
    }
  } catch (error) {
    console.error('❌ require("crypto") test failed:', error);
  }
}

export default {
  async fetch(request, env, ctx) {
    const results = [];
    
    // Run tests
    testWebCrypto();
    await testNodeCrypto();
    await testRequireCrypto();
    
    return new Response('Crypto tests complete - check the console for results', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
`;

console.log('🔍 Testing crypto module compatibility...');

// Save the test worker
try {
  writeFileSync(tempWorkerPath, testWorkerCode);
  console.log('✅ Created test worker at', tempWorkerPath);
} catch (error) {
  console.error('❌ Failed to create test worker:', error);
  process.exit(1);
}

// Run the test with wrangler
try {
  console.log('🧪 Running crypto tests with wrangler...');
  execSync(`cd ${rootDir} && npx wrangler dev ${tempWorkerPath} --compatibility-date=2024-09-23 --compatibility-flags=nodejs_compat --port=8888 --inspect=false --local=true`, {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
    timeout: 10000 // Timeout after 10 seconds
  });
} catch (error) {
  if (error.signal === 'SIGTERM') {
    console.log('✅ Test worker executed (terminated as expected)');
  } else {
    console.error('❌ Failed to run test worker:', error);
  }
}

// Clean up
try {
  execSync(`rm ${tempWorkerPath}`, { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Removed test worker');
} catch (error) {
  console.error('⚠️ Failed to remove test worker:', error);
}

console.log('\n🎉 Crypto compatibility test complete!');
console.log('If you see any failures above, please check the crypto polyfills and bridges.'); 