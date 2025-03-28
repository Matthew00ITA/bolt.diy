#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔧 MANUAL FIX - Direct line replacement fix');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');

if (!existsSync(functionsDistDir)) {
  console.error('❌ Error: functions/dist directory not found. Run build first.');
  process.exit(1);
}

// Define a function to recursively fix all index.js files in a directory
function fixAllIndexFiles(directory) {
  if (!existsSync(directory)) return;
  
  // Get a list of all files in this directory
  const allFiles = readdirSync(directory, { withFileTypes: true });
  
  // Process each file/directory
  for (const file of allFiles) {
    const fullPath = join(directory, file.name);
    
    if (file.isDirectory()) {
      // Recursively process subdirectories
      fixAllIndexFiles(fullPath);
    } else if (file.name === 'index.js') {
      // Fix this index.js file
      console.log(`🔍 Found index.js file: ${fullPath}`);
      fixIndexFile(fullPath);
    }
  }
}

// Function to fix a single index.js file
function fixIndexFile(filePath) {
  console.log(`\n📄 Processing file: ${filePath}`);
  
  try {
    // Read the file
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    
    // Loop through all lines looking for await statements
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('await') && !lines[i].includes('async function')) {
        console.log(`Line ${i+1}: Found 'await' at: ${lines[i].trim()}`);
        
        // Look backwards for the function declaration
        for (let j = i; j >= Math.max(0, i-10); j--) {
          if (lines[j].includes('function') || (lines[j].includes('mjs"()') && lines[j].includes('{'))) {
            console.log(`Line ${j+1}: Found potential function: ${lines[j].trim()}`);
            
            // Check if this looks like a node module function declaration that needs fixing
            if (lines[j].includes('.mjs"()') || lines[j].includes('/node/i')) {
              console.log(`🎯 Target found at line ${j+1}`);
              
              // Remove any existing async
              lines[j] = lines[j].replace(/\(\)\s*async\s*{/, '() {');
              
              // Transform the await line into an IIFE
              if (!lines[i].includes('(async function()')) {
                const indentation = lines[i].match(/^\s*/)[0];
                const awaitContent = lines[i].replace(/^\s*await\s+/, '');
                lines[i] = `${indentation}(async function() { await ${awaitContent} })();`;
              }
              
              console.log(`✅ Fixed await at line ${i+1}`);
              modified = true;
              // Skip ahead to avoid processing the same function multiple times
              break;
            }
          }
        }
      }
    }
    
    // Write the file back if modified
    if (modified) {
      writeFileSync(filePath, lines.join('\n'));
      console.log(`✅ Successfully fixed file: ${filePath}`);
    } else {
      console.log(`✅ No issues found in file: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
  }
}

try {
  // First, ensure we have a new build
  console.log('🔄 Rebuilding functions to get a fresh file...');
  try {
    execSync('npx wrangler pages functions build --outdir=./functions/dist --minify=false --compatibility-flags nodejs_compat --compatibility-date 2024-09-23', { 
      stdio: 'inherit',
      cwd: rootDir,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096 --no-warnings' }
    });
  } catch (error) {
    console.log('⚠️ Build failed, but we will try to fix the existing files.');
  }
  
  // Fix all index.js files in the functions/dist directory
  console.log('🔍 Scanning for all index.js files in the functions/dist directory...');
  fixAllIndexFiles(functionsDistDir);
  
  console.log('\n🎉 All index.js files have been processed!');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('🎉 Manual fix completed! Try deploying again.'); 