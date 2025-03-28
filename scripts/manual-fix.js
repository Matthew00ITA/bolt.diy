#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔧 MANUAL FIX - Direct line replacement fix');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');

if (!existsSync(functionsDistDir) || !existsSync(indexFile)) {
  console.error('❌ Error: functions/dist/index.js file not found. Run build first.');
  process.exit(1);
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
    console.log('⚠️ Build failed, but we will try to fix the existing file.');
  }
  
  // Read the file
  console.log('📄 Reading index.js file...');
  const content = readFileSync(indexFile, 'utf-8');
  
  // Find the exact problematic line - the one with utils.mjs"() async {
  const lines = content.split('\n');
  const problematicLineIndex = lines.findIndex(line => 
    line.includes('utils.mjs"()') && (line.includes(' async') || line.includes('() async'))
  );
  
  if (problematicLineIndex !== -1) {
    console.log(`🎯 Found problematic line at ${problematicLineIndex + 1}:`);
    console.log(lines[problematicLineIndex]);
    
    // Create the correct fixed line
    // This must simply remove the 'async' keyword entirely from this line
    // We'll handle await separately by wrapping it in a immediately-invoked function expression
    const originalLine = lines[problematicLineIndex];
    const fixedLine = originalLine.replace(/\(\)\s*async\s*{/, '() {');
    
    console.log('✏️ Fixed line:');
    console.log(fixedLine);
    
    // Replace the line
    lines[problematicLineIndex] = fixedLine;
    
    // Now find the await line following it
    if (problematicLineIndex + 1 < lines.length && lines[problematicLineIndex + 1].includes('await')) {
      const awaitLine = lines[problematicLineIndex + 1];
      console.log(`🔍 Found await line: ${awaitLine}`);
      
      // Replace the await with a self-executing async function
      const fixedAwaitLine = awaitLine.replace(
        /\s*await\s+([^;]+);/,
        '    (async function() { await $1; })();'
      );
      
      console.log('✏️ Fixed await line:');
      console.log(fixedAwaitLine);
      
      // Replace the line
      lines[problematicLineIndex + 1] = fixedAwaitLine;
    }
    
    // Write the file back
    writeFileSync(indexFile, lines.join('\n'));
    console.log('✅ Successfully applied direct fix to the file!');
    
    // Verify the file
    console.log('🔍 Verifying the file...');
    const verifyContent = readFileSync(indexFile, 'utf-8');
    const verifyLines = verifyContent.split('\n');
    console.log(`Verified line ${problematicLineIndex + 1}: ${verifyLines[problematicLineIndex]}`);
    if (problematicLineIndex + 1 < verifyLines.length) {
      console.log(`Verified line ${problematicLineIndex + 2}: ${verifyLines[problematicLineIndex + 1]}`);
    }
  } else {
    console.log('⚠️ Could not find the problematic line with utils.mjs"() async {');
    
    // Try a more generic fix - search for lines with utils.mjs
    const utilsLines = lines.map((line, index) => ({ line, index }))
      .filter(({line}) => line.includes('utils.mjs'))
      .map(({line, index}) => ({ line, index, nextLine: index + 1 < lines.length ? lines[index + 1] : '' }))
      .filter(({nextLine}) => nextLine.includes('await'));
    
    if (utilsLines.length > 0) {
      console.log(`🔍 Found ${utilsLines.length} potential utils.mjs followed by await lines.`);
      
      let fixed = false;
      for (const { line, index, nextLine } of utilsLines) {
        console.log(`Examining line ${index + 1}: ${line}`);
        console.log(`Next line ${index + 2}: ${nextLine}`);
        
        // Fix this pair of lines
        lines[index] = line.replace(/\(\)\s*async\s*{/, '() {');
        lines[index + 1] = nextLine.replace(
          /\s*await\s+([^;]+);/,
          '    (async function() { await $1; })();'
        );
        
        fixed = true;
        console.log(`✅ Fixed lines ${index + 1}-${index + 2}`);
      }
      
      if (fixed) {
        // Write the fixed content
        writeFileSync(indexFile, lines.join('\n'));
        console.log('✅ Successfully applied fixes!');
      } else {
        console.error('❌ Found potential problematic lines but could not fix them.');
      }
    } else {
      // Last resort - try a whole-file fix
      console.log('🔄 Trying whole-file replacement...');
      
      // Replace any "() async {" with a normal function declaration
      // And wrap the await in a self-executing async function
      let fixedContent = content
        .replace(/"\(\)\s*async\s*{(\s*\n\s*)await/g, '"() {$1(async function() { await')
        .replace(/await\s+([^;]+);/g, 'await $1; })();');
      
      if (fixedContent !== content) {
        writeFileSync(indexFile, fixedContent);
        console.log('✅ Applied whole-file fix!');
      } else {
        console.error('❌ Could not fix the file. Manual intervention required.');
        console.log('📋 Please manually edit functions/dist/index.js line 86 to remove "async" and fix the await.');
        process.exit(1);
      }
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('🎉 Manual fix completed! Try deploying again.'); 