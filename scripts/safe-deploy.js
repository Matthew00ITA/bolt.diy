#!/usr/bin/env node
import { execSync } from 'child_process';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting safe deployment process...');

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

  // Run the build process
  console.log('🔨 Building the application...');
  execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });

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