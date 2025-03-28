#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚨 EMERGENCY DIRECT PATCH - Fixing exact line from error log');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');
const nodeIndexFile = join(functionsDistDir, 'node', 'index.js');

// Check both potential files
const files = [indexFile, nodeIndexFile];
for (const file of files) {
  if (existsSync(file)) {
    console.log(`📄 Found file: ${file}`);
    try {
      // Read the file content
      const content = readFileSync(file, 'utf-8');
      
      // Convert to array of lines for editing specific line numbers
      const lines = content.split('\n');
      
      // First check if we can find the exact line number from the error (line 102-103)
      // The error message shows: functions/dist/index.js:102
      const lineRange = [90, 120]; // Check a range around line 102
      let exactLineFound = false;
      
      console.log(`🔍 Examining lines ${lineRange[0]}-${lineRange[1]} for await statements...`);
      for (let i = lineRange[0]; i < Math.min(lineRange[1], lines.length); i++) {
        if (lines[i].trim().startsWith('await ')) {
          // Found an await line - now look for the preceding function line
          console.log(`Line ${i+1}: Found await: ${lines[i].trim()}`);
          
          // Look backward for function definition (should be very close)
          for (let j = i-1; j >= Math.max(0, i-5); j--) {
            // Look for node/i pattern as shown in the error message
            if (lines[j].includes('/node/i') && lines[j].includes('{')) {
              console.log(`Line ${j+1}: Function: ${lines[j].trim()}`);
              
              // Determine indentation from the await line
              const indentation = lines[i].match(/^\s*/)[0];
              
              // Get the await expression
              const awaitExpression = lines[i].trim().replace(/^await\s+/, '');
              
              // Replace the await line with a self-executing async function
              lines[i] = `${indentation}(async function() { await ${awaitExpression} })();`;
              
              console.log(`🛠️ Fixed line ${i+1}: ${lines[i]}`);
              exactLineFound = true;
              break;
            }
          }
          
          if (exactLineFound) break;
        }
      }
      
      // If we didn't find the exact line, try a more generic approach
      if (!exactLineFound) {
        console.log('⚠️ Could not find the exact line mentioned in the error log.');
        console.log('🔍 Searching for all await statements...');
        
        let modified = false;
        // Scan the entire file for await statements
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('await ')) {
            console.log(`Line ${i+1}: Found await: ${lines[i].trim()}`);
            
            // Get the indentation
            const indentation = lines[i].match(/^\s*/)[0];
            
            // Get the await expression
            const awaitExpression = lines[i].trim().replace(/^await\s+/, '');
            
            // Replace with self-executing async function
            lines[i] = `${indentation}(async function() { await ${awaitExpression} })();`;
            
            console.log(`🛠️ Fixed line ${i+1}`);
            modified = true;
          }
        }
        
        if (modified) {
          console.log('✅ Applied fixes to all await statements');
        } else {
          console.log('⚠️ Could not find any bare await statements to fix');
        }
      }
      
      // Write back the patched content
      writeFileSync(file, lines.join('\n'));
      console.log(`✅ Successfully patched file: ${file}`);
    } catch (error) {
      console.error(`❌ Error processing file ${file}:`, error);
    }
  }
}

console.log('🎉 Direct patch completed! Try deploying again.'); 