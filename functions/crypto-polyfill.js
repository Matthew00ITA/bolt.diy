// Ensure crypto is always defined and properly initialized
// This file should be imported before any other imports in functions

// Make sure global crypto exists with required methods
if (typeof globalThis.crypto === 'undefined') {
  console.warn('Crypto API is undefined - initializing polyfill');
  globalThis.crypto = {};
}

if (typeof globalThis.crypto.subtle === 'undefined') {
  console.warn('Crypto subtle API is undefined - initializing polyfill');
  globalThis.crypto.subtle = {
    // Minimal implementations
    digest: async (algorithm, data) => {
      console.warn('Using fallback crypto.subtle.digest');
      // This is a fallback that should never be used in production
      // It just prevents crashes during development
      return new Uint8Array(32); // Return dummy data to prevent crashes
    },
    encrypt: async () => {
      console.warn('Using fallback crypto.subtle.encrypt');
      return new Uint8Array(32);
    },
    decrypt: async () => {
      console.warn('Using fallback crypto.subtle.decrypt');
      return new Uint8Array(32);
    },
    sign: async () => {
      console.warn('Using fallback crypto.subtle.sign');
      return new Uint8Array(32);
    },
    verify: async () => {
      console.warn('Using fallback crypto.subtle.verify');
      return false;
    },
    generateKey: async () => {
      console.warn('Using fallback crypto.subtle.generateKey');
      return {};
    },
    deriveKey: async () => {
      console.warn('Using fallback crypto.subtle.deriveKey');
      return {};
    },
    deriveBits: async () => {
      console.warn('Using fallback crypto.subtle.deriveBits');
      return new Uint8Array(32);
    },
    importKey: async () => {
      console.warn('Using fallback crypto.subtle.importKey');
      return {};
    },
    exportKey: async () => {
      console.warn('Using fallback crypto.subtle.exportKey');
      return new Uint8Array(32);
    },
    wrapKey: async () => {
      console.warn('Using fallback crypto.subtle.wrapKey');
      return new Uint8Array(32);
    },
    unwrapKey: async () => {
      console.warn('Using fallback crypto.subtle.unwrapKey');
      return {};
    }
  };
}

if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  console.warn('Crypto getRandomValues is undefined - initializing polyfill');
  globalThis.crypto.getRandomValues = function(array) {
    console.warn('Using fallback crypto.getRandomValues');
    // Fill with pseudo-random data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// Polyfill randomUUID if not available
if (typeof globalThis.crypto.randomUUID === 'undefined') {
  console.warn('Crypto randomUUID is undefined - initializing polyfill');
  globalThis.crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Export for explicit usage
export const ensuredCrypto = globalThis.crypto;

console.log('✅ Crypto polyfill initialized'); 