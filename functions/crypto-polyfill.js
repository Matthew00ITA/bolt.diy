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

// Export for explicit usage
export const ensuredCrypto = globalThis.crypto;

console.log('✅ Crypto polyfill initialized'); 