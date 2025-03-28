#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚨 SYNTAX ERROR FIX - Fixing syntax error at line 3977');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');

if (!existsSync(indexFile)) {
  console.error('❌ Error: functions/dist/index.js file not found. Run build first.');
  process.exit(1);
}

try {
  // Read the file content
  console.log('📄 Reading index.js file...');
  const content = readFileSync(indexFile, 'utf-8');
  
  // Convert to array of lines for editing specific line numbers
  const lines = content.split('\n');
  
  // Check around line 3977 (look 20 lines before and after to be safe)
  const targetLine = 3977;
  const startLine = Math.max(0, targetLine - 20);
  const endLine = Math.min(lines.length - 1, targetLine + 20);
  
  console.log(`🔍 Examining lines ${startLine}-${endLine} for syntax error...`);
  
  // Show the lines in question
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
  
  // Check if we can find the exact error pattern
  let fixedContent = content;
  
  // Try to find and fix the "replace: replace2" pattern
  if (fixedContent.includes('replace: replace2')) {
    console.log('🎯 Found syntax error pattern: "replace: replace2"');
    
    // Fix: Add a comma after replace2
    fixedContent = fixedContent.replace('replace: replace2', 'replace: replace2,');
    console.log('✅ Fixed: Added comma after replace2');
  } 
  // Or fix it to the standard JavaScript object notation
  else if (fixedContent.includes('replace:replace2')) {
    console.log('🎯 Found alternative syntax error pattern: "replace:replace2"');
    
    // Fix: Add a comma after replace2
    fixedContent = fixedContent.replace('replace:replace2', 'replace:replace2,');
    console.log('✅ Fixed: Added comma after replace2');
  }
  // If we can't find the exact pattern, try a more general regex
  else {
    console.log('⚠️ Exact pattern not found, trying regex matching...');
    
    // Try to fix using regex to match the pattern more generally
    const fixedWithRegex = fixedContent.replace(
      /(\s+replace\s*:\s*replace2)(?!\s*,|\s*})/g,
      '$1,'
    );
    
    if (fixedWithRegex !== fixedContent) {
      fixedContent = fixedWithRegex;
      console.log('✅ Fixed with regex: Added comma after replace2');
    } else {
      // If still not found, let's check line 3977 directly
      if (lines.length > 3977) {
        console.log(`🔍 Examining line 3977 directly: ${lines[3976]}`);
        
        // Try to fix the specific line
        if (lines[3976].includes(':') && !lines[3976].includes(';') && !lines[3976].trim().endsWith(',')) {
          lines[3976] = lines[3976].trim() + ',';
          fixedContent = lines.join('\n');
          console.log('✅ Fixed line 3977: Added comma at the end');
        }
      }
    }
  }
  
  // Check if we actually changed anything
  if (fixedContent !== content) {
    // Write back the patched content
    writeFileSync(indexFile, fixedContent);
    console.log('✅ Successfully fixed syntax error in index.js');
  } else {
    console.error('⚠️ Could not find the exact syntax error to fix.');
    
    // Last resort: Manually fix the line 3977 to use semicolon instead of colon
    if (lines.length > 3977) {
      const line3977 = lines[3976]; // 0-indexed
      if (line3977.includes(':')) {
        const fixedLine = line3977.replace(/:\s*([^\s,;{}]+)(\s*)$/, '; $1$2');
        lines[3976] = fixedLine;
        writeFileSync(indexFile, lines.join('\n'));
        console.log('🔧 Applied manual fix to line 3977');
      }
    }
  }
  
  console.log('🎉 Syntax error fix completed!');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} 