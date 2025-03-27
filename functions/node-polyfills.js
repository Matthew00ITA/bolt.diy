// Polyfills for Node.js built-in modules in Cloudflare Workers
// Import this file at the top of your entry point

// Crypto is handled in crypto-polyfill.js

// Stream polyfill
if (typeof globalThis.stream === 'undefined') {
  globalThis.stream = {
    Transform: class Transform {
      constructor() {
        console.warn('Using stream.Transform polyfill');
      }
      _transform() {}
      _flush() {}
      pipe() { return this; }
    }
  };
}

// Process polyfill
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    nextTick: (fn) => setTimeout(fn, 0),
    version: '',
    versions: { node: '16.0.0' }
  };
}

// Events polyfill
if (typeof globalThis.events === 'undefined') {
  class EventEmitter {
    constructor() {
      this._events = {};
    }
    on(event, listener) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
      return this;
    }
    emit(event, ...args) {
      if (!this._events[event]) return false;
      this._events[event].forEach(listener => listener(...args));
      return true;
    }
    removeListener(event, listener) {
      if (!this._events[event]) return this;
      this._events[event] = this._events[event].filter(l => l !== listener);
      return this;
    }
  }
  globalThis.events = {
    EventEmitter
  };
}

// Add global Buffer if needed
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from: (data, encoding) => {
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        return encoder.encode(data);
      }
      return new Uint8Array(data);
    },
    isBuffer: (obj) => obj instanceof Uint8Array,
    alloc: (size) => new Uint8Array(size)
  };
}

console.log('✅ Node.js polyfills initialized');
