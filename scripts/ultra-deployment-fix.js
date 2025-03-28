#!/usr/bin/env node
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🛠️ Ultra Deployment Fix - Emergency Async/Await Issue Fixer');

// Target the specific file with issues
const functionsDistDir = join(rootDir, 'functions', 'dist');
const indexFile = join(functionsDistDir, 'index.js');

if (!existsSync(functionsDistDir)) {
  console.error('❌ Error: functions/dist directory not found. Run build first.');
  process.exit(1);
}

if (!existsSync(indexFile)) {
  console.error('❌ Error: functions/dist/index.js file not found. Run build first.');
  process.exit(1);
}

try {
  console.log('📄 Reading index.js file...');
  let content = readFileSync(indexFile, 'utf-8');
  const lines = content.split('\n');
  
  // Count the lines with await and without async context
  const awaitLines = [];
  
  // Find all await statements
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('await ')) {
      awaitLines.push(i);
      console.log(`🔍 Found 'await' at line ${i+1}: ${lines[i].trim()}`);
    }
  }
  
  console.log(`🔍 Found ${awaitLines.length} lines with await statements`);
  
  // For each await, look backward to find where we need to add async
  let fixCount = 0;
  for (const lineIndex of awaitLines) {
    // Look backward to find the function declaration
    let foundAsync = false;
    let asyncAdded = false;
    
    for (let j = lineIndex; j >= Math.max(0, lineIndex - 15); j--) {
      if (lines[j].includes('async')) {
        foundAsync = true;
        break;
      }
      
      if (lines[j].includes('function') && !lines[j].includes('async')) {
        // Add async to this line
        lines[j] = lines[j].replace('function', 'async function');
        console.log(`✅ Added async at line ${j+1}: ${lines[j].trim()}`);
        fixCount++;
        asyncAdded = true;
        break;
      }
    }
    
    if (!foundAsync && !asyncAdded) {
      console.log(`⚠️ Could not find function declaration for await at line ${lineIndex+1}`);
    }
  }
  
  // Special fix for the specific problem at line 87 (from error log)
  // Check specifically lines 80-90 
  let lineRange = [80, 90];
  if (lines.length >= lineRange[0]) {
    let rangeEnd = Math.min(lineRange[1], lines.length);
    console.log(`🔍 Looking specifically at lines ${lineRange[0]}-${rangeEnd}...`);
    
    // Extract and show this section of code
    console.log('Code section:');
    for (let i = lineRange[0] - 1; i < rangeEnd; i++) {
      console.log(`${i+1}: ${lines[i]}`);
      
      // Look specifically for await init_functionsRoutes
      if (lines[i].includes('await init_functionsRoutes_')) {
        console.log(`🎯 Found target await at line ${i+1}`);
        
        // Look backward for function
        let foundTarget = false;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (lines[j].includes('function') && !lines[j].includes('async')) {
            // Force this to be async
            lines[j] = lines[j].replace('function', 'async function');
            console.log(`🚨 EMERGENCY FIX: Added async at line ${j+1}`);
            fixCount++;
            foundTarget = true;
            break;
          }
        }
        
        if (!foundTarget) {
          console.log(`⚠️ Could not find function declaration for target await at line ${i+1}`);
        }
      }
    }
  }
  
  // Update the content if we made changes
  if (fixCount > 0) {
    console.log(`✏️ Writing fixed content with ${fixCount} changes...`);
    writeFileSync(indexFile, lines.join('\n'));
    console.log('✅ Fixed successfully!');
  } else {
    console.log('⚠️ No fixes were applied - file unchanged');
  }
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('🎉 Ultra deployment fix completed! Try deploying again.'); 