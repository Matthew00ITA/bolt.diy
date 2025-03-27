import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverBuildPath = join(rootDir, 'build', 'server', 'index.js');
const functionsBuildPath = join(rootDir, 'functions', 'build');
const tempBuildPath = join(rootDir, 'temp_build_backup.js');
const wranglerPath = join(rootDir, 'wrangler.toml');
const tempWranglerPath = join(rootDir, 'temp_wrangler_backup.toml');
const hasExistingBuild = existsSync(serverBuildPath);
const hasWrangler = existsSync(wranglerPath);

console.log('🧹 Starting clean operation...');

// Backup the build file if it exists
if (hasExistingBuild) {
  console.log('💾 Backing up server build...');
  try {
    copyFileSync(serverBuildPath, tempBuildPath);
    console.log('✅ Build backed up successfully');
  } catch (error) {
    console.error('⚠️ Failed to backup build:', error);
    // Continue anyway
  }
}

// Backup wrangler.toml if it exists
if (hasWrangler) {
  console.log('💾 Backing up wrangler.toml...');
  try {
    copyFileSync(wranglerPath, tempWranglerPath);
    console.log('✅ Wrangler config backed up successfully');
  } catch (error) {
    console.error('⚠️ Failed to backup wrangler config:', error);
    // Continue anyway
  }
}

// Clean functions build
if (existsSync(functionsBuildPath)) {
  console.log('🗑️ Removing functions build directory...');
  try {
    execSync(`rm -rf ${functionsBuildPath}`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Functions build directory removed');
  } catch (error) {
    console.error('⚠️ Failed to remove functions build directory:', error);
    // Continue anyway
  }
}

// Clean node_modules
console.log('🗑️ Removing node_modules...');
try {
  execSync('find . -name "node_modules" -type d -prune | xargs rm -rf', { 
    stdio: 'inherit', 
    cwd: rootDir 
  });
  console.log('✅ node_modules removed');
} catch (error) {
  console.error('❌ Failed to remove node_modules:', error);
  process.exit(1);
}

// Clean lock files
console.log('🗑️ Removing lock files...');
try {
  execSync('find . -name "package-lock.json" -o -name "yarn.lock" -o -name "pnpm-lock.yaml" | xargs rm -f', { 
    stdio: 'inherit', 
    cwd: rootDir 
  });
  console.log('✅ Lock files removed');
} catch (error) {
  console.error('❌ Failed to remove lock files:', error);
  process.exit(1);
}

// Reinstall dependencies
console.log('📦 Reinstalling dependencies...');
try {
  execSync('pnpm install', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Dependencies reinstalled');
} catch (error) {
  console.error('❌ Failed to reinstall dependencies:', error);
  process.exit(1);
}

// Restore wrangler.toml if it was backed up
if (hasWrangler) {
  console.log('🔄 Restoring wrangler config...');
  try {
    copyFileSync(tempWranglerPath, wranglerPath);
    execSync(`rm ${tempWranglerPath}`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Wrangler config restored successfully');
  } catch (error) {
    console.error('⚠️ Failed to restore wrangler config:', error);
    // Continue anyway
  }
}

// Restore or rebuild
if (hasExistingBuild) {
  console.log('🔄 Restoring server build...');
  try {
    // Ensure directories exist
    mkdirSync(dirname(serverBuildPath), { recursive: true });
    copyFileSync(tempBuildPath, serverBuildPath);
    execSync(`rm ${tempBuildPath}`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Build restored successfully');
  } catch (error) {
    console.log('⚠️ Could not restore build, generating a new one...');
    try {
      execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });
      console.log('✅ Build generated successfully');
    } catch (buildError) {
      console.error('❌ Failed to generate build:', buildError);
      process.exit(1);
    }
  }
} else {
  console.log('🔨 Generating a new build...');
  try {
    execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Build generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate build:', error);
    process.exit(1);
  }
}

// Run the fix-functions-build script to ensure functions has correct paths
console.log('🔧 Fixing functions build paths...');
try {
  execSync('node scripts/fix-functions-build.js', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Functions build paths fixed');
} catch (error) {
  console.error('❌ Failed to fix functions build paths:', error);
  process.exit(1);
}

console.log('🎉 Clean operation completed successfully!');
