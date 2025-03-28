#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚨 EMERGENCY DIRECT PATCH - Fixing ALL await issues');

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
      
      // Look for ALL await statements in the entire file
      console.log(`🔍 Examining entire file for await statements...`);
      let totalFixed = 0;
      
      for (let i = 0; i < lines.length; i++) {
        // First pass: find all await lines
        if (lines[i].trim().startsWith('await ')) {
          console.log(`Line ${i+1}: Found await: ${lines[i].trim()}`);
          
          // Look backward for function definition (should be very close)
          let functionFixed = false;
          for (let j = i-1; j >= Math.max(0, i-5); j--) {
            // Look for node/i pattern or any mjs pattern as shown in the error message
            if ((lines[j].includes('/node/i') || lines[j].includes('.mjs"()')) && 
                lines[j].includes('{')) {
              console.log(`Line ${j+1}: Function: ${lines[j].trim()}`);
              
              // Determine indentation from the await line
              const indentation = lines[i].match(/^\s*/)[0];
              
              // Get the await expression
              const awaitExpression = lines[i].trim().replace(/^await\s+/, '');
              
              // Replace the await line with a self-executing async function
              lines[i] = `${indentation}(async function() { await ${awaitExpression} })();`;
              
              console.log(`🛠️ Fixed line ${i+1}: ${lines[i]}`);
              totalFixed++;
              functionFixed = true;
              break;
            }
          }
          
          // If we couldn't find the specific function line, fix it anyway
          if (!functionFixed) {
            console.log(`⚠️ Couldn't identify function for line ${i+1}, fixing anyway`);
            const indentation = lines[i].match(/^\s*/)[0];
            const awaitExpression = lines[i].trim().replace(/^await\s+/, '');
            lines[i] = `${indentation}(async function() { await ${awaitExpression} })();`;
            totalFixed++;
          }
        }
      }
      
      if (totalFixed > 0) {
        // Write back the patched content
        writeFileSync(file, lines.join('\n'));
        console.log(`✅ Successfully patched file with ${totalFixed} fixes: ${file}`);
      } else {
        console.log(`ℹ️ No await statements to fix in: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing file ${file}:`, error);
    }
  } else {
    console.log(`⚠️ File does not exist: ${file}`);
  }
}

// Also scan for any other index.js files that might have the same issue
function findAndFixAllIndexFiles(directory) {
  if (!existsSync(directory)) return;
  
  try {
    const entries = readdirSync(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories, but skip node_modules
        if (entry.name !== 'node_modules') {
          findAndFixAllIndexFiles(fullPath);
        }
      } else if (entry.name.endsWith('.js')) {
        // Check this JS file for await statements
        try {
          const content = readFileSync(fullPath, 'utf-8');
          
          if (content.includes('await ')) {
            console.log(`🔍 Found potential await in: ${fullPath}`);
            
            // Apply the same fixes as above
            const lines = content.split('\n');
            let modified = false;
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].trim().startsWith('await ')) {
                const indentation = lines[i].match(/^\s*/)[0];
                const awaitExpression = lines[i].trim().replace(/^await\s+/, '');
                lines[i] = `${indentation}(async function() { await ${awaitExpression} })();`;
                modified = true;
                console.log(`🛠️ Fixed line ${i+1} in ${fullPath}`);
              }
            }
            
            if (modified) {
              writeFileSync(fullPath, lines.join('\n'));
              console.log(`✅ Fixed await issues in: ${fullPath}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error checking file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${directory}:`, error);
  }
}

// Recursively scan for other JS files with await
console.log(`\n🔍 Scanning for additional JS files with await issues...`);
findAndFixAllIndexFiles(functionsDistDir);

console.log('🎉 Direct patch completed! All await issues should be fixed now.'); 