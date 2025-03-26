import type { ValidationIssue } from './ImportValidator';

// Check if a value is a valid JSON string
export function isValidJsonString(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

// Validate the schema of the imported settings
export function validateSettingsSchema(data: any, _fileName?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if the data is an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    issues.push({
      type: 'error',
      message: 'Invalid settings format',
      details: 'The imported data must be a JSON object.',
    });
    return issues;
  }

  // Check metadata
  if (!data._meta) {
    issues.push({
      type: 'warning',
      message: 'Missing metadata',
      field: '_meta',
      details: 'The settings file does not contain metadata. This may be an older or incompatible format.',
    });
  } else {
    // Check the version
    if (!data._meta.version) {
      issues.push({
        type: 'warning',
        message: 'Missing version information',
        field: '_meta.version',
        details: 'The settings file does not specify a version, which might cause compatibility issues.',
      });
    } else if (data._meta.version !== '2.0') {
      issues.push({
        type: 'warning',
        message: `Unsupported version: ${data._meta.version}`,
        field: '_meta.version',
        details: 'This settings file uses a different version than the current application expects (2.0).',
      });
    }
  }

  // Check for essential sections
  const essentialSections = ['core', 'providers', 'features', 'ui'];
  const missingSections = essentialSections.filter((section) => !data[section]);

  if (missingSections.length > 0) {
    issues.push({
      type: 'warning',
      message: `Missing essential settings sections: ${missingSections.join(', ')}`,
      details: 'Some important settings sections are missing, which might result in partial settings import.',
    });
  }

  // Check core settings
  if (data.core) {
    console.log('Validating core settings:', Object.keys(data.core));

    // Check if any core setting exists instead of requiring specific ones
    const hasCoreSettings = Object.keys(data.core).some(
      (key) => data.core[key] !== null && data.core[key] !== undefined,
    );

    if (!hasCoreSettings) {
      issues.push({
        type: 'warning',
        message: 'Empty core settings',
        field: 'core',
        details: 'The core settings section appears to be empty.',
      });
    } else if (!data.core.bolt_user_profile && !data.core.bolt_settings) {
      // Only a warning if specific expected keys are missing
      issues.push({
        type: 'warning',
        message: 'Missing common user settings',
        field: 'core',
        details: 'Some commonly expected user profile or settings keys are not present, but other core settings exist.',
      });
    }
  }

  // Check provider settings
  if (data.providers) {
    // Check if provider settings contains valid API keys
    if (data.providers.apiKeys) {
      try {
        const apiKeys =
          typeof data.providers.apiKeys === 'string' ? JSON.parse(data.providers.apiKeys) : data.providers.apiKeys;

        if (typeof apiKeys !== 'object' || Array.isArray(apiKeys)) {
          issues.push({
            type: 'warning',
            message: 'Invalid API keys format',
            field: 'providers.apiKeys',
            details: 'API keys should be in a key-value object format.',
          });
        }
      } catch (error) {
        issues.push({
          type: 'warning',
          message: 'Could not parse API keys',
          field: 'providers.apiKeys',
          details: `Error parsing API keys: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // Check provider_settings
    if (data.providers.provider_settings) {
      try {
        const providerSettings =
          typeof data.providers.provider_settings === 'string'
            ? JSON.parse(data.providers.provider_settings)
            : data.providers.provider_settings;

        if (typeof providerSettings !== 'object') {
          issues.push({
            type: 'warning',
            message: 'Invalid provider settings format',
            field: 'providers.provider_settings',
            details: 'Provider settings should be in an object format.',
          });
        }
      } catch (error) {
        issues.push({
          type: 'warning',
          message: 'Could not parse provider settings',
          field: 'providers.provider_settings',
          details: `Error parsing provider settings: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  return issues;
}

// Validate the imported API keys
export function validateApiKeys(data: any, _fileName?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if the data is an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    issues.push({
      type: 'error',
      message: 'Invalid API keys format',
      details: 'The imported data must be a JSON object.',
    });
    return issues;
  }

  // Check for comment fields (to differentiate from a regular JSON file)
  const hasCommentField = Object.keys(data).some((key) => key.startsWith('_'));

  if (!hasCommentField) {
    issues.push({
      type: 'warning',
      message: 'Possibly not an API keys file',
      details: "This file doesn't have any comment fields, which are typically present in API keys template files.",
    });
  }

  // Check for known provider keys
  const knownProviders = [
    'Anthropic',
    'OpenAI',
    'Google',
    'Groq',
    'HuggingFace',
    'OpenRouter',
    'Deepseek',
    'Mistral',
    'OpenAILike',
    'Together',
    'xAI',
    'Perplexity',
    'Cohere',
    'AzureOpenAI',
  ];

  const foundProviders = knownProviders.filter(
    (provider) => data[provider] !== undefined || data[`${provider}_API_KEY`] !== undefined,
  );

  if (foundProviders.length === 0) {
    issues.push({
      type: 'warning',
      message: 'No recognized API providers',
      details: `The file doesn't contain any of the expected provider keys: ${knownProviders.join(', ')}`,
    });
  }

  // Check for invalid values
  Object.entries(data).forEach(([key, value]) => {
    // Skip comment fields
    if (key.startsWith('_')) {
      return;
    }

    // Check if the value is a string and not empty
    if (typeof value !== 'string') {
      issues.push({
        type: 'error',
        message: `Invalid value type for key: ${key}`,
        field: key,
        details: `The value must be a string, but got ${typeof value}.`,
      });
    } else if (value.trim() === '') {
      issues.push({
        type: 'warning',
        message: `Empty value for key: ${key}`,
        field: key,
        details: 'This key has an empty value, which might be intentional but could cause issues if needed.',
      });
    }
  });

  return issues;
}
