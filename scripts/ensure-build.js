import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverBuildPath = join(rootDir, 'build', 'server', 'index.js');

console.log('🔍 Checking if server build exists...');

if (!existsSync(serverBuildPath)) {
  console.log('⚠️ Server build not found. Generating build...');
  
  try {
    console.log('🔄 Running build process...');
    execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build process failed:', error);
    process.exit(1);
  }
} else {
  console.log('✅ Server build already exists at:', serverBuildPath);
}

console.log('🚀 Ready to proceed!'); 