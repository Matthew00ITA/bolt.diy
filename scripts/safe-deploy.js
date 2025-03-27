#!/usr/bin/env node
import { execSync } from 'child_process';
import { join } from 'path';
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting safe deployment process...');

// Helper function to directly fix async/await issues
function fixAsyncAwaitIssues() {
  console.log('🔧 Checking for async/await issues in compiled files...');
  
  const functionsDistDir = join(rootDir, 'functions', 'dist');
  if (!existsSync(functionsDistDir)) {
    console.log('⚠️ Functions dist directory not found, skipping fix');
    return;
  }
  
  const indexFile = join(functionsDistDir, 'index.js');
  if (!existsSync(indexFile)) {
    console.log('⚠️ Functions index.js not found, skipping fix');
    return;
  }
  
  try {
    let content = readFileSync(indexFile, 'utf-8');
    
    // Look for specific pattern of the error with init_functionsRoutes function
    if (content.includes('await init_functionsRoutes_')) {
      console.log('🔧 Found async/await issue, fixing...');
      
      // Find the problematic function declaration and make it async
      const pattern = /function\s*\(\)\s*{\s*\n\s*await\s+init_functionsRoutes_/g;
      if (pattern.test(content)) {
        content = content.replace(
          /function\s*\(\)\s*{\s*\n\s*await\s+init_functionsRoutes_/g,
          'async function() {\n    await init_functionsRoutes_'
        );
        
        writeFileSync(indexFile, content);
        console.log('✅ Fixed async/await issue in functions index.js');
      } else {
        console.log('⚠️ Could not find exact pattern to fix');
      }
    } else {
      console.log('✅ No async/await issues found');
    }
  } catch (error) {
    console.error('⚠️ Error fixing async/await issues:', error);
  }
}

// Make sure we have a clean state
try {
  // Clean up any previous build files that might contain secrets
  const functionsBuildDir = join(rootDir, 'functions', 'build');
  const functionsDistDir = join(rootDir, 'functions', 'dist');

  if (existsSync(functionsBuildDir)) {
    console.log('🧹 Removing previous functions build directory...');
    rmSync(functionsBuildDir, { recursive: true, force: true });
  }

  if (existsSync(functionsDistDir)) {
    console.log('🧹 Removing previous functions dist directory...');
    rmSync(functionsDistDir, { recursive: true, force: true });
  }

  // Run the build process with increased memory and no warnings
  console.log('🔨 Building the application...');
  execSync('NODE_OPTIONS="--max-old-space-size=4096 --no-warnings" pnpm run build', { 
    stdio: 'inherit', 
    cwd: rootDir 
  });

  // Fix any async/await issues in the generated code before deploying
  fixAsyncAwaitIssues();

  // Deploy to Cloudflare
  console.log('📡 Deploying to Cloudflare Pages...');
  execSync('wrangler pages deploy ./build/client', { stdio: 'inherit', cwd: rootDir });

  // Clean up after deployment
  console.log('🧹 Cleaning up build artifacts...');
  if (existsSync(functionsBuildDir)) {
    rmSync(functionsBuildDir, { recursive: true, force: true });
  }
  if (existsSync(functionsDistDir)) {
    rmSync(functionsDistDir, { recursive: true, force: true });
  }

  console.log('✅ Deployment completed successfully!');
} catch (error) {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
} 