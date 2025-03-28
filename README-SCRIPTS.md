# Bolt Scripts Documentation

This file documents the build, deployment, and utility scripts available in the Bolt project.

## Core Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Builds the application with Vite and fixes functions build paths |
| `npm run deploy` | Builds and deploys the application to Cloudflare Pages |
| `npm run dev` | Starts the development server |
| `npm run test` | Runs the test suite once |
| `npm run test:watch` | Runs the test suite in watch mode |
| `npm run lint` | Lints the codebase |
| `npm run lint:fix` | Lints and automatically fixes issues in the codebase |
| `npm run typecheck` | Type checks the TypeScript code |
| `npm run typegen` | Generates TypeScript types for Cloudflare Wrangler |
| `npm run preview` | Builds and starts the application locally to preview production build |
| `npm run clean` | Cleans build artifacts and temporary files |
| `npm run quick-clean` | Quickly cleans essential build artifacts |

## Helper Scripts

| Script | Description |
|--------|-------------|
| `npm run ensure-build` | Checks for and ensures a valid build exists |
| `npm run test-crypto` | Tests the crypto module compatibility |
| `npm run start` | Starts the application correctly based on OS (Windows or Unix) |
| `npm run start:windows` | Windows-specific start command |
| `npm run start:unix` | Unix-specific start command |

## Docker Commands

| Script | Description |
|--------|-------------|
| `npm run dockerbuild` | Builds the development Docker image |
| `npm run dockerbuild:prod` | Builds the production Docker image |
| `npm run dockerrun` | Runs the Docker container |
| `npm run dockerstart` | Starts the application inside Docker container |

## Implementation Notes

The build and deployment process involves several fixes for Cloudflare Workers compatibility:

1. **Functions Build Fix**: `fix-functions-build.js` handles:
   - Copying server build to functions directory
   - Creating polyfills for Node.js built-ins (crypto, stream, process, etc.)
   - Fixing async/await issues in generated code
   - Applying ESM syntax fixes

2. **Cloudflare Compatibility**: 
   - The build process includes special handling for Cloudflare Workers environment
   - Polyfills for Node.js built-ins that are not available in Cloudflare Workers
   - Syntax fixes for ESM modules and async/await usage

For updating or modifying the build process, check the `scripts/fix-functions-build.js` file which contains the main build fixers. 