#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🛠️ DIRECT LINE FIX - Emergency fix for line 86');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');

if (!existsSync(functionsDistDir) || !existsSync(indexFile)) {
  console.error('❌ Error: functions/dist/index.js file not found. Run build first.');
  process.exit(1);
}

try {
  console.log('📄 Reading index.js file...');
  const content = readFileSync(indexFile, 'utf-8');
  const lines = content.split('\n');
  
  // Look for line 86 specifically (or nearby lines if the line numbers are slightly different)
  const startLine = 80;
  const endLine = 95;
  
  console.log(`📊 Examining lines ${startLine+1}-${endLine+1}...`);
  
  // Print these lines for debugging
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    console.log(`Line ${i+1}: ${lines[i]}`);
  }
  
  // Find any line with utils.mjs followed by a line with await
  let targetLine = -1;
  for (let i = startLine; i < endLine && i+1 < lines.length; i++) {
    if (lines[i].includes('utils.mjs') && lines[i+1].includes('await')) {
      targetLine = i;
      console.log(`🎯 Found target at line ${targetLine+1}: ${lines[targetLine]}`);
      console.log(`Followed by await at line ${targetLine+2}: ${lines[targetLine+1]}`);
      break;
    }
  }
  
  if (targetLine === -1) {
    console.log('⚠️ Could not find target line with utils.mjs followed by await');
    
    // Try a different approach - look for any line with utils.mjs
    for (let i = startLine; i < endLine; i++) {
      if (lines[i].includes('utils.mjs')) {
        targetLine = i;
        console.log(`🔍 Found utils.mjs at line ${targetLine+1}: ${lines[targetLine]}`);
        break;
      }
    }
  }
  
  if (targetLine !== -1) {
    // Direct line modification - remove any existing async and add it in the correct position
    const originalLine = lines[targetLine];
    
    // Make sure we don't have an async already
    if (originalLine.includes('async')) {
      console.log('🚫 Line already contains "async", checking syntax...');
    }
    
    // Format: ensure we have '() async {' at the end of the line
    const fixedLine = originalLine.replace(/\(\)\s*async\s*{/, '() {').replace(/\(\)\s*{/, '() async {');
    if (fixedLine !== originalLine) {
      console.log('✏️ Fixing line syntax:');
      console.log(`Before: ${originalLine}`);
      console.log(`After:  ${fixedLine}`);
      
      lines[targetLine] = fixedLine;
      
      // Write the file back
      writeFileSync(indexFile, lines.join('\n'));
      console.log('✅ Successfully fixed the file!');
      
      // Verify the fix
      const verifyContent = readFileSync(indexFile, 'utf-8');
      const verifyLines = verifyContent.split('\n');
      console.log(`✅ Verified fix at line ${targetLine+1}: ${verifyLines[targetLine]}`);
    } else {
      console.log('⚠️ No changes needed or unable to fix line');
    }
  } else {
    console.log('❌ Could not find any line with utils.mjs in expected range.');
    
    // Last resort: direct string replacement on the entire file
    console.log('🔄 Trying full file replacement...');
    const newContent = content
      .replace(/(utils\.mjs"\s*\(\))\s*{(\s*\n\s*await)/g, '$1 async {$2')
      .replace(/(utils\.mjs"\s*\(\))\s*async\s*{(\s*\n\s*await)/g, '$1 async {$2');
      
    if (newContent !== content) {
      writeFileSync(indexFile, newContent);
      console.log('✅ Applied full file fix!');
    } else {
      console.error('❌ Could not fix the file by any method. Manual intervention required.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('🎉 Direct line fix completed! Try deploying again.'); 