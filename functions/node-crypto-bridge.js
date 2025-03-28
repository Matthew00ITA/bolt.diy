// Bridge between node:crypto and Web Crypto API for Cloudflare workers
// This file should be imported whenever node:crypto is needed

// Import the crypto polyfill first to ensure basic Web Crypto API is available
import './crypto-polyfill.js';

// Create a module.exports that mimics node:crypto
const crypto = {
  // Common crypto functions from node:crypto
  createHash: (algorithm) => {
    console.log(`Using polyfilled createHash with algorithm: ${algorithm}`);
    
    // Simple hash context simulation
    let data = new Uint8Array();
    
    return {
      update: (chunk, encoding) => {
        let buffer;
        if (typeof chunk === 'string') {
          const encoder = new TextEncoder();
          buffer = encoder.encode(chunk);
        } else if (chunk instanceof Uint8Array) {
          buffer = chunk;
        } else if (chunk instanceof ArrayBuffer) {
          buffer = new Uint8Array(chunk);
        } else {
          console.warn('Unsupported data type in hash.update');
          buffer = new Uint8Array();
        }
        
        // Append to existing data
        const newData = new Uint8Array(data.length + buffer.length);
        newData.set(data);
        newData.set(buffer, data.length);
        data = newData;
        
        return this;
      },
      digest: (encoding = 'hex') => {
        // Use Web Crypto API's subtle.digest
        return globalThis.crypto.subtle.digest(
          algorithm === 'sha256' ? 'SHA-256' : 
          algorithm === 'sha1' ? 'SHA-1' : 
          algorithm === 'sha384' ? 'SHA-384' : 
          algorithm === 'sha512' ? 'SHA-512' : 
          'SHA-256',
          data
        ).then(hashBuffer => {
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          if (encoding === 'hex') {
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          } else if (encoding === 'base64') {
            return btoa(String.fromCharCode.apply(null, hashArray));
          } else {
            return new Uint8Array(hashBuffer);
          }
        });
      }
    };
  },
  
  // Randomness functions
  randomBytes: (size) => {
    return globalThis.crypto.getRandomValues(new Uint8Array(size));
  },
  
  // Constant-time comparison (important for security)
  timingSafeEqual: (a, b) => {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }
};

// Add our crypto implementation to globalThis so it can be accessed by require('crypto')
globalThis.nodeCrypto = crypto;

// Export for direct imports
export default crypto;

console.log('✅ Node crypto bridge initialized'); 