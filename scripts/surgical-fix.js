#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔪 SURGICAL FIX - Targeting exact error pattern');

const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');

if (!existsSync(functionsDistDir) || !existsSync(indexFile)) {
  console.error('❌ Error: functions/dist/index.js file not found. Run build first.');
  process.exit(1);
}

try {
  console.log('📄 Reading index.js file...');
  const content = readFileSync(indexFile, 'utf-8');
  
  // Fixed: Split exact part at line 86-87 we need to fix
  console.log('🧬 Analyzing file for exact error pattern...');
  
  // Extract the lines mentioning in the error log (86-87)
  // Look for this exact pattern
  const needle = '  "../node_modules/.pnpm/unenv@2.0.0-rc.14/node_modules/unenv/dist/runtime/_internal/utils.mjs"() {';
  const needleLine = content.split('\n').findIndex(line => line.includes(needle));
  
  if (needleLine === -1) {
    console.log('🔍 Looking for alternate patterns...');
    
    // Try a more generic approach - looking for any unenv utils.mjs
    const pattern1 = /"\.\.\/(node_modules\/[^"]*unenv[^"]*\/dist\/runtime\/_internal\/utils\.mjs)"\(\)\s*{/;
    const match = content.match(pattern1);
    
    if (match) {
      console.log('✅ Found match with pattern:', match[0]);
      
      // Get the next line to check if it contains await
      const lines = content.split('\n');
      const lineIndex = lines.findIndex(line => line.includes(match[0]));
      
      if (lineIndex !== -1 && lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1];
        
        if (nextLine.includes('await')) {
          console.log('🎯 Found the exact error pattern:');
          console.log(`${lineIndex + 1}: ${lines[lineIndex]}`);
          console.log(`${lineIndex + 2}: ${nextLine}`);
          
          // Fix it by making the function async
          lines[lineIndex] = lines[lineIndex].replace(/"\(\)\s*{/, '") async {');
          
          console.log('✅ Fixed the function declaration:');
          console.log(`${lineIndex + 1}: ${lines[lineIndex]}`);
          
          // Write the result back
          writeFileSync(indexFile, lines.join('\n'));
          console.log('✅ Successfully fixed the file - precise surgical fix applied!');
          process.exit(0);
        }
      }
    }
    
    // Try another approach - find all await lines and look at preceding line
    const lines = content.split('\n');
    let fixed = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('await') && i > 0) {
        // Extract function name from await line
        const awaitMatch = lines[i].match(/await\s+(\w+)_(\w+)_(\d+)/);
        if (awaitMatch) {
          const funcName = awaitMatch[1];
          
          // Look for any line before that defines a function and contains utils.mjs
          for (let j = i - 10; j < i; j++) {
            if (j >= 0 && lines[j].includes('utils.mjs') && lines[j].includes('() {')) {
              console.log(`🎯 Found function definition at line ${j+1} with await at line ${i+1}`);
              
              // Fix the function declaration
              lines[j] = lines[j].replace(/"\(\)\s*{/, '") async {');
              fixed = true;
              console.log(`✅ Fixed: ${lines[j]}`);
              break;
            }
          }
          
          if (fixed) break;
        }
      }
    }
    
    if (fixed) {
      writeFileSync(indexFile, lines.join('\n'));
      console.log('✅ Successfully fixed the file - alternate approach applied!');
      process.exit(0);
    }
    
    // DIRECT FIX: If all else fails, just do the DIRECT fix
    console.log('⚡ Applying direct emergency fix...');
    
    let directContent = content;
    directContent = directContent.replace(
      /("\.\.\/node_modules\/[^"]*unenv[^"]*\/dist\/runtime\/_internal\/utils\.mjs"\s*\(\))\s*{(\s*\n\s*await)/g,
      '$1 async {$2'
    );
    
    // Check if we made any changes
    if (directContent !== content) {
      writeFileSync(indexFile, directContent);
      console.log('✅ Successfully applied direct emergency fix!');
      process.exit(0);
    }
    
    console.error('❌ Could not find the exact pattern to fix. Manual intervention required.');
    process.exit(1);
  } else {
    console.log(`🎯 Found exact error line at ${needleLine + 1}`);
    
    // Get the line to see if it matches our expectations
    const lines = content.split('\n');
    console.log(`Line ${needleLine + 1}: ${lines[needleLine]}`);
    
    // Check the next line to make sure it has await
    if (needleLine + 1 < lines.length && lines[needleLine + 1].includes('await')) {
      console.log(`Line ${needleLine + 2}: ${lines[needleLine + 1]}`);
      
      // Fix the function declaration by adding async
      const fixedLine = lines[needleLine].replace('"() {', '") async {');
      lines[needleLine] = fixedLine;
      
      console.log('✅ Fixed function declaration:');
      console.log(`Line ${needleLine + 1}: ${fixedLine}`);
      
      // Write the fixed content back
      writeFileSync(indexFile, lines.join('\n'));
      console.log('✅ Successfully fixed the exact error!');
      
      // Check result
      const verifyContent = readFileSync(indexFile, 'utf-8');
      const verifyLine = verifyContent.split('\n')[needleLine];
      console.log(`✅ Verified line ${needleLine + 1}: ${verifyLine}`);
    } else {
      console.error('❌ Found the function line but next line doesn\'t contain await as expected.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('🔪 Surgical fix completed! Try deploying again.'); 