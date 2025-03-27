import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverBuildPath = join(rootDir, 'build', 'server', 'index.js');
const functionsBuildPath = join(rootDir, 'functions', 'build');
const functionsDistPath = join(rootDir, 'functions', 'dist');
const tempBuildPath = join(rootDir, 'temp_build_backup.js');
const wranglerPath = join(rootDir, 'wrangler.toml');
const tempWranglerPath = join(rootDir, 'temp_wrangler_backup.toml');
const hasExistingBuild = existsSync(serverBuildPath);
const hasWrangler = existsSync(wranglerPath);

// Parse command line arguments
const args = process.argv.slice(2);
const isQuickClean = args.includes('--quick');

// Function to fix async/await issues in compiled code
function fixAsyncAwaitIssues() {
  console.log('🔧 Checking for async/await issues in compiled files...');
  
  if (!existsSync(functionsDistPath)) {
    console.log('⚠️ Functions dist directory not found, skipping fix');
    return;
  }
  
  const indexFile = join(functionsDistPath, 'index.js');
  if (!existsSync(indexFile)) {
    console.log('⚠️ Functions index.js not found, skipping fix');
    return;
  }
  
  try {
    let content = readFileSync(indexFile, 'utf-8');
    
    // Fix the most common async/await pattern issue with init functions
    if (content.includes('await init_functionsRoutes_')) {
      console.log('🔧 Found async/await issue with init_functionsRoutes, fixing...');
      
      // Fix any node_modules pattern to ensure it has async before function
      content = content.replace(
        /("[^"]+node_modules[^"]+"\s*,\s*)function\s*\(\)\s*{(\s*\n\s*await)/g, 
        '$1async function() {$2'
      );
      
      // Fix any function with await to ensure it has async
      content = content.replace(
        /function\s*\([^)]*\)\s*{(\s*\n\s*await)/g,
        'async function() {$1'
      );
      
      writeFileSync(indexFile, content);
      console.log('✅ Fixed async/await issues');
    } else {
      console.log('✅ No known async/await issues found');
    }
  } catch (error) {
    console.error('⚠️ Error checking/fixing async/await issues:', error);
  }
}

console.log(`🧹 Starting ${isQuickClean ? 'quick ' : ''}clean operation...`);

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

// Clean functions dist
if (existsSync(functionsDistPath)) {
  console.log('🗑️ Removing functions dist directory...');
  try {
    execSync(`rm -rf ${functionsDistPath}`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Functions dist directory removed');
  } catch (error) {
    console.error('⚠️ Failed to remove functions dist directory:', error);
    // Continue anyway
  }
}

// Only clean node_modules if not in quick mode
if (!isQuickClean) {
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

// After running the fix-functions-build script
console.log('🔧 Checking for async/await issues...');
fixAsyncAwaitIssues();
console.log('🎉 Clean operation completed successfully!');
