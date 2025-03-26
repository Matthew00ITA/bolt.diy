/**
 * Retrieves API keys from environment variables
 */
export function getSearchApiKeys() {
  const keys: Record<string, string> = {};

  // Add Serper.dev API key for Google, DuckDuckGo, and Academic
  if (process.env.SERPER_API_KEY) {
    keys.Google = process.env.SERPER_API_KEY;
    keys.DuckDuckGo = process.env.SERPER_API_KEY;
    keys.Academic = process.env.SERPER_API_KEY;
  }

  // Add Bing Search API key
  if (process.env.BING_SEARCH_API_KEY) {
    keys.Bing = process.env.BING_SEARCH_API_KEY;
  }

  // Add Perplexity API key
  if (process.env.PERPLEXITY_API_KEY) {
    keys.Perplexity = process.env.PERPLEXITY_API_KEY;
  }

  /*
   * Add any provider-specific API keys here if they differ
   * Example: if (process.env.GOOGLE_API_KEY) keys.Google = process.env.GOOGLE_API_KEY;
   */

  return keys;
}

/**
 * Checks if we're running in development mode
 */
export function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development';
}
