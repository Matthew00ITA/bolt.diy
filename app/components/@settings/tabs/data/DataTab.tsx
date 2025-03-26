import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { DialogRoot, DialogClose, Dialog, DialogTitle } from '~/components/ui/Dialog';
import { db, getAll, deleteById } from '~/lib/persistence';
import Cookies from 'js-cookie';
import ProgressIndicator from './ProgressIndicator';
import GranularExportModal from './GranularExportModal';
import ImportValidator from './ImportValidator';
import type { ValidationIssue } from './ImportValidator';
import { validateSettingsSchema, validateApiKeys } from './validationUtils';
import ExportHistoryPanel from './ExportHistoryPanel';
import { ExportHistoryManager } from './ExportHistoryManager';
import AutoBackupPanel from './AutoBackupPanel';
import AutoBackupList from './AutoBackupList';

export default function DataTab() {
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingKeys, setIsImportingKeys] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetInlineConfirm, setShowResetInlineConfirm] = useState(false);
  const [showDeleteInlineConfirm, setShowDeleteInlineConfirm] = useState(false);

  // Progress indicator states
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [showExportProgress, setShowExportProgress] = useState(false);
  const [showImportProgress, setShowImportProgress] = useState(false);

  // Granular export state
  const [showGranularExport, setShowGranularExport] = useState(false);

  // Import validation states
  const [showSettingsValidator, setShowSettingsValidator] = useState(false);
  const [showApiKeysValidator, setShowApiKeysValidator] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [pendingImportData, setPendingImportData] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAllChats = async () => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats from IndexedDB
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-chats-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Chats exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export chats');
    }
  };

  const handleExportSettings = (selectedCategories?: string[]) => {
    try {
      console.log('Starting settings export');
      setShowExportProgress(true);
      setExportProgress(10); // Initial progress

      // Get all localStorage keys
      const allLocalStorageKeys = Object.keys(localStorage);
      console.log('All localStorage keys:', allLocalStorageKeys);
      setExportProgress(20); // Update progress

      // Get all cookies
      const allCookies = Cookies.get();
      console.log('All cookies:', Object.keys(allCookies));
      setExportProgress(30); // Update progress

      // Create a comprehensive settings object
      const settingsData: Record<string, any> = {
        // Export metadata
        _meta: {
          exportDate: new Date().toISOString(),
          version: '2.0',
          appVersion: process.env.NEXT_PUBLIC_VERSION || 'unknown',
          selectedCategories: selectedCategories || 'all',
        },
      };

      // Add core settings if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('core')) {
        settingsData.core = {
          // User profile and main settings
          bolt_user_profile: safeGetItem('bolt_user_profile'),
          bolt_settings: safeGetItem('bolt_settings'),
          bolt_profile: safeGetItem('bolt_profile'),
          theme: safeGetItem('theme'),
        };
      }

      // Add provider settings if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('providers')) {
        settingsData.providers = {
          // Provider configurations from localStorage
          provider_settings: safeGetItem('provider_settings'),

          // API keys from cookies
          apiKeys: allCookies.apiKeys,

          // Selected provider and model
          selectedModel: allCookies.selectedModel,
          selectedProvider: allCookies.selectedProvider,

          // Provider-specific settings
          providers: allCookies.providers,
        };
      }

      // Add feature settings if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('features')) {
        settingsData.features = {
          // Feature flags
          viewed_features: safeGetItem('bolt_viewed_features'),
          developer_mode: safeGetItem('bolt_developer_mode'),

          // Context optimization
          contextOptimizationEnabled: safeGetItem('contextOptimizationEnabled'),

          // Auto-select template
          autoSelectTemplate: safeGetItem('autoSelectTemplate'),

          // Latest branch
          isLatestBranch: safeGetItem('isLatestBranch'),

          // Event logs
          isEventLogsEnabled: safeGetItem('isEventLogsEnabled'),

          // Energy saver settings
          energySaverMode: safeGetItem('energySaverMode'),
          autoEnergySaver: safeGetItem('autoEnergySaver'),
        };
      }

      // Add UI configuration if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('ui')) {
        settingsData.ui = {
          // Tab configuration
          bolt_tab_configuration: safeGetItem('bolt_tab_configuration'),
          tabConfiguration: allCookies.tabConfiguration,

          // Prompt settings
          promptId: safeGetItem('promptId'),
          cachedPrompt: allCookies.cachedPrompt,
        };
      }

      // Add connections if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('connections')) {
        settingsData.connections = {
          // Netlify connection
          netlify_connection: safeGetItem('netlify_connection'),

          // GitHub connections
          ...getGitHubConnections(allCookies),
        };
      }

      // Add debug settings if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('debug')) {
        settingsData.debug = {
          // Debug settings
          isDebugEnabled: allCookies.isDebugEnabled,
          acknowledged_debug_issues: safeGetItem('bolt_acknowledged_debug_issues'),
          acknowledged_connection_issue: safeGetItem('bolt_acknowledged_connection_issue'),

          // Error logs
          error_logs: safeGetItem('error_logs'),
          bolt_read_logs: safeGetItem('bolt_read_logs'),

          // Event logs
          eventLogs: allCookies.eventLogs,
        };
      }

      // Add update settings if selected or if no selection provided
      if (!selectedCategories || selectedCategories.includes('updates')) {
        settingsData.updates = {
          update_settings: safeGetItem('update_settings'),
          last_acknowledged_update: safeGetItem('bolt_last_acknowledged_version'),
        };
      }

      // Add raw data only if all categories are selected or if no specific selection
      if (!selectedCategories) {
        settingsData._raw = {
          localStorage: getAllLocalStorage(),
          cookies: allCookies,
        };
      }

      setExportProgress(70); // Update progress after building the data structure
      console.log('Export data structure:', Object.keys(settingsData));

      // Create and download the JSON file
      const exportJson = JSON.stringify(settingsData, null, 2);
      console.log('Export size:', exportJson.length, 'bytes');
      setExportProgress(85); // Update progress

      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const categoryLabel =
        selectedCategories && selectedCategories.length < 7 ? `-${selectedCategories.join('-')}` : '';
      const filename = `bolt-settings${categoryLabel}-${new Date().toISOString().replace(/:/g, '-')}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Record this export in the history
      ExportHistoryManager.addExport(filename, selectedCategories, exportJson.length);

      console.log('Settings exported successfully as', filename);
      setExportProgress(100); // Complete progress

      // Toast will be shown after the progress indicator completes
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export settings: ' + (error instanceof Error ? error.message : String(error)));
      setShowExportProgress(false);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setImportProgress(10); // Initial progress

      const content = await file.text();
      console.log('Importing settings file:', file.name);
      setImportProgress(20); // Update progress

      // Parse the imported data
      const importedData = JSON.parse(content);
      console.log('Parsed import data structure:', Object.keys(importedData));
      setImportProgress(30); // Update progress

      // Validate the imported data
      const issues = validateSettingsSchema(importedData, file.name);
      console.log('Validation issues:', issues);
      setImportProgress(40);

      // If there are issues, show the validator
      if (issues.length > 0) {
        setValidationIssues(issues);
        setPendingImportFile(file);
        setPendingImportData(importedData);
        setShowSettingsValidator(true);

        return;
      }

      // No issues, proceed with import
      await proceedWithSettingsImport(importedData);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import settings: ' + (error instanceof Error ? error.message : String(error)));
      setShowImportProgress(false);
    } finally {
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // New function to handle the import after validation
  const proceedWithSettingsImport = async (importedData: any) => {
    try {
      setShowImportProgress(true);
      setImportProgress(50); // Update progress

      // Check if this is the new comprehensive format (v2.0)
      const isNewFormat = importedData._meta?.version === '2.0';
      console.log('Import format version:', isNewFormat ? '2.0' : 'legacy');

      if (isNewFormat) {
        // Import using the new comprehensive format
        await importComprehensiveFormat(importedData);
      } else {
        // Try to handle older formats
        await importLegacyFormat(importedData);
      }

      setImportProgress(90); // Update progress
      console.log('Settings import completed, will reload page after progress completes');
      setImportProgress(100); // Complete progress

      // Reload will happen after progress indicator completes via onComplete callback
    } catch (error) {
      console.error('Import error during processing:', error);
      toast.error('Failed to import settings: ' + (error instanceof Error ? error.message : String(error)));
      setShowImportProgress(false);
    } finally {
      // Clear any pending import data
      setPendingImportFile(null);
      setPendingImportData(null);
    }
  };

  // Modified API keys import to include validation
  const handleImportAPIKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const keysData = JSON.parse(content);

      // Validate the API keys
      const issues = validateApiKeys(keysData, file.name);
      console.log('API keys validation issues:', issues);

      // If there are validation issues, show the validator
      if (issues.length > 0) {
        setValidationIssues(issues);
        setPendingImportFile(file);
        setPendingImportData(keysData);
        setShowApiKeysValidator(true);

        return;
      }

      // No issues, proceed with import
      await proceedWithApiKeysImport(keysData);
    } catch (error) {
      console.error('Error importing API keys:', error);
      toast.error('Failed to import API keys: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (apiKeyFileInputRef.current) {
        apiKeyFileInputRef.current.value = '';
      }
    }
  };

  // New function to handle API keys import after validation
  const proceedWithApiKeysImport = async (keysData: any) => {
    try {
      setIsImportingKeys(true);

      // Get existing keys from cookies
      const existingKeys = (() => {
        const storedApiKeys = Cookies.get('apiKeys');
        return storedApiKeys ? JSON.parse(storedApiKeys) : {};
      })();

      // Validate and save each key
      const newKeys = { ...existingKeys };

      Object.entries(keysData).forEach(([key, value]) => {
        // Skip comment fields
        if (key.startsWith('_')) {
          return;
        }

        // Skip base URL fields (they should be set in .env.local)
        if (key.includes('_API_BASE_URL')) {
          return;
        }

        if (typeof value !== 'string') {
          throw new Error(`Invalid value for key: ${key}`);
        }

        // Handle both old and new template formats
        let normalizedKey = key;

        // Check if this is the old format (e.g., "Anthropic_API_KEY")
        if (key.includes('_API_KEY')) {
          // Extract the provider name from the old format
          normalizedKey = key.replace('_API_KEY', '');
        }

        /*
         * Only add non-empty keys
         * Use the normalized key in the correct format
         * (e.g., "OpenAI", "Google", "Anthropic")
         */
        if (value) {
          newKeys[normalizedKey] = value;
        }
      });

      // Save to cookies
      Cookies.set('apiKeys', JSON.stringify(newKeys));

      toast.success('API keys imported successfully');

      // Reload the page to apply the changes
      window.location.reload();
    } catch (error) {
      console.error('Error processing API keys:', error);
      toast.error('Failed to import API keys: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsImportingKeys(false);
      setPendingImportFile(null);
      setPendingImportData(null);
    }
  };

  // Handle cancel validation
  const handleCancelValidation = () => {
    setShowSettingsValidator(false);
    setShowApiKeysValidator(false);
    setPendingImportFile(null);
    setPendingImportData(null);
    setValidationIssues([]);
  };

  // Handle confirm settings validation
  const handleConfirmSettingsValidation = () => {
    setShowSettingsValidator(false);

    if (pendingImportData) {
      proceedWithSettingsImport(pendingImportData);
    }
  };

  // Handle confirm API keys validation
  const handleConfirmApiKeysValidation = () => {
    setShowApiKeysValidator(false);

    if (pendingImportData) {
      proceedWithApiKeysImport(pendingImportData);
    }
  };

  // Handler for when export progress completes
  const handleExportComplete = () => {
    setShowExportProgress(false);

    // Only show one toast message for successful export
    toast.success('Settings exported successfully', {
      toastId: 'settings-export-success', // Add a unique ID to prevent duplicate toasts
    });
  };

  // Handler for when import progress completes
  const handleImportComplete = () => {
    setShowImportProgress(false);
    toast.success('Settings imported successfully');

    // Use setTimeout to ensure the toast is shown before reload
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Helper function to import the new comprehensive format
  const importComprehensiveFormat = async (data: any) => {
    console.log('Importing using comprehensive format');

    // Import core settings
    if (data.core) {
      console.log('Importing core settings:', Object.keys(data.core));
      Object.entries(data.core).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing core setting ${key}:`, err);
          }
        }
      });
    }

    // Import provider settings
    if (data.providers) {
      console.log('Importing provider settings:', Object.keys(data.providers));

      // Import provider_settings to localStorage
      if (data.providers.provider_settings) {
        try {
          safeSetItem('provider_settings', data.providers.provider_settings);
        } catch (err) {
          console.error('Error importing provider settings:', err);
        }
      }

      // Import API keys and other provider cookies
      const providerCookies = ['apiKeys', 'selectedModel', 'selectedProvider', 'providers'];
      providerCookies.forEach((key) => {
        if (data.providers[key]) {
          try {
            safeSetCookie(key, data.providers[key]);
          } catch (err) {
            console.error(`Error importing provider cookie ${key}:`, err);
          }
        }
      });
    }

    // Import feature settings
    if (data.features) {
      console.log('Importing feature settings:', Object.keys(data.features));
      Object.entries(data.features).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing feature setting ${key}:`, err);
          }
        }
      });
    }

    // Import UI configuration
    if (data.ui) {
      console.log('Importing UI configuration:', Object.keys(data.ui));

      // Import localStorage UI settings
      if (data.ui.bolt_tab_configuration) {
        try {
          safeSetItem('bolt_tab_configuration', data.ui.bolt_tab_configuration);
        } catch (err) {
          console.error('Error importing tab configuration:', err);
        }
      }

      if (data.ui.promptId) {
        try {
          safeSetItem('promptId', data.ui.promptId);
        } catch (err) {
          console.error('Error importing promptId:', err);
        }
      }

      // Import cookie UI settings
      if (data.ui.tabConfiguration) {
        try {
          safeSetCookie('tabConfiguration', data.ui.tabConfiguration);
        } catch (err) {
          console.error('Error importing tab configuration cookie:', err);
        }
      }

      if (data.ui.cachedPrompt) {
        try {
          safeSetCookie('cachedPrompt', data.ui.cachedPrompt);
        } catch (err) {
          console.error('Error importing cached prompt:', err);
        }
      }
    }

    // Import connections
    if (data.connections) {
      console.log('Importing connections:', Object.keys(data.connections));

      // Import netlify connection
      if (data.connections.netlify_connection) {
        try {
          safeSetItem('netlify_connection', data.connections.netlify_connection);
        } catch (err) {
          console.error('Error importing netlify connection:', err);
        }
      }

      // Import GitHub connections
      Object.entries(data.connections).forEach(([key, value]) => {
        if (key.startsWith('git:') && value !== null && value !== undefined) {
          try {
            safeSetCookie(key, value);
          } catch (err) {
            console.error(`Error importing GitHub connection ${key}:`, err);
          }
        }
      });
    }

    // Import debug settings
    if (data.debug) {
      console.log('Importing debug settings:', Object.keys(data.debug));

      // Import localStorage debug settings
      ['acknowledged_debug_issues', 'error_logs', 'bolt_read_logs'].forEach((key) => {
        if (data.debug[key]) {
          try {
            safeSetItem(key, data.debug[key]);
          } catch (err) {
            console.error(`Error importing debug setting ${key}:`, err);
          }
        }
      });

      // Import cookie debug settings
      ['isDebugEnabled', 'eventLogs'].forEach((key) => {
        if (data.debug[key]) {
          try {
            safeSetCookie(key, data.debug[key]);
          } catch (err) {
            console.error(`Error importing debug cookie ${key}:`, err);
          }
        }
      });
    }

    // Import update settings
    if (data.updates) {
      console.log('Importing update settings:', Object.keys(data.updates));
      Object.entries(data.updates).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing update setting ${key}:`, err);
          }
        }
      });
    }

    // If all else fails, try to import from raw data
    if (data._raw) {
      console.log('Attempting to import from raw data as fallback');

      // Import raw localStorage data
      if (data._raw.localStorage) {
        Object.entries(data._raw.localStorage).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            try {
              safeSetItem(key, value);
            } catch (err) {
              console.error(`Error importing raw localStorage ${key}:`, err);
            }
          }
        });
      }

      // Import raw cookie data
      if (data._raw.cookies) {
        Object.entries(data._raw.cookies).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            try {
              safeSetCookie(key, value);
            } catch (err) {
              console.error(`Error importing raw cookie ${key}:`, err);
            }
          }
        });
      }
    }
  };

  // Helper function to import legacy formats
  const importLegacyFormat = async (data: any) => {
    console.log('Importing using legacy format');

    // Handle the format with localStorage and cookies sections
    if (data.localStorage && typeof data.localStorage === 'object') {
      console.log('Importing localStorage settings from legacy format');

      // Import localStorage settings
      Object.entries(data.localStorage).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing localStorage item ${key}:`, err);
          }
        }
      });
    }

    if (data.cookies && typeof data.cookies === 'object') {
      console.log('Importing cookie settings from legacy format');

      // Import cookie settings
      Object.entries(data.cookies).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            // Skip gitSettings as it's handled separately
            if (key !== 'gitSettings') {
              safeSetCookie(key, value);
            }
          } catch (err) {
            console.error(`Error importing cookie ${key}:`, err);
          }
        }
      });

      // Handle git settings separately
      if (data.cookies.gitSettings) {
        try {
          // Parse gitSettings if it's a string (it might be pre-stringified)
          const gitSettings =
            typeof data.cookies.gitSettings === 'string'
              ? JSON.parse(data.cookies.gitSettings)
              : data.cookies.gitSettings;

          console.log('Importing git settings from legacy format');

          Object.entries(gitSettings).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              try {
                safeSetCookie(key, value);
              } catch (err) {
                console.error(`Error importing git cookie ${key}:`, err);
              }
            }
          });
        } catch (err) {
          console.error('Error processing git settings:', err);
        }
      }
    }

    // Handle the oldest format (direct userProfile and settings)
    else if (data.userProfile || data.settings) {
      console.log('Importing using oldest format');

      // Handle old format
      if (data.userProfile) {
        try {
          safeSetItem('bolt_user_profile', data.userProfile);
        } catch (err) {
          console.error('Error importing user profile from oldest format:', err);
        }
      }

      if (data.settings) {
        try {
          safeSetItem('bolt_settings', data.settings);
        } catch (err) {
          console.error('Error importing settings from oldest format:', err);
        }
      }
    }
  };

  // Helper functions for import
  const safeSetItem = (key: string, value: any) => {
    try {
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`Setting localStorage[${key}]`);
      localStorage.setItem(key, valueToStore);
    } catch (err) {
      console.error(`Error setting localStorage item ${key}:`, err);
      throw err;
    }
  };

  const safeSetCookie = (key: string, value: any) => {
    try {
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`Setting cookie[${key}]`);
      Cookies.set(key, valueToStore, { expires: 30 });
    } catch (err) {
      console.error(`Error setting cookie ${key}:`, err);
      throw err;
    }
  };

  const handleDownloadTemplate = () => {
    setIsDownloadingTemplate(true);

    try {
      /*
       * Create a template with provider names as keys
       * This matches how the application stores API keys in cookies
       */
      const template = {
        Anthropic: '',
        OpenAI: '',
        Google: '',
        Groq: '',
        HuggingFace: '',
        OpenRouter: '',
        Deepseek: '',
        Mistral: '',
        OpenAILike: '',
        Together: '',
        xAI: '',
        Perplexity: '',
        Cohere: '',
        AzureOpenAI: '',
      };

      // Add a comment to explain the format
      const templateWithComment = {
        _comment:
          "Fill in your API keys for each provider. Keys will be stored with the provider name (e.g., 'OpenAI'). The application also supports the older format with keys like 'OpenAI_API_KEY' for backward compatibility.",
        ...template,
      };

      const blob = new Blob([JSON.stringify(templateWithComment, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-api-keys-template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleResetSettings = async () => {
    setIsResetting(true);

    try {
      console.log('Starting settings reset');

      // Define patterns for settings-related keys
      const settingsPatterns = [
        /^bolt_settings/,
        /^bolt_profile/,
        /^bolt_user_profile/,
        /^bolt_tab_configuration/,
        /^theme$/,
        /^provider_settings$/,
        /^contextOptimizationEnabled$/,
        /^autoSelectTemplate$/,
        /^energySaverMode$/,
        /^autoEnergySaver$/,
        /^update_settings$/,
      ];

      // Settings-related cookies to reset
      const settingsCookies = ['selectedModel', 'selectedProvider', 'providers', 'tabConfiguration', 'apiKeys'];

      // 1. Only clear localStorage items related to settings
      const allLocalStorageKeys = Object.keys(localStorage);
      console.log('Checking localStorage items for settings reset:', allLocalStorageKeys.length, 'items found');

      allLocalStorageKeys.forEach((key) => {
        // Check if the key matches any settings pattern
        const isSettingsKey = settingsPatterns.some((pattern) => pattern.test(key));

        if (isSettingsKey) {
          try {
            console.log(`Removing settings-related localStorage item: ${key}`);
            localStorage.removeItem(key);
          } catch (err) {
            console.error(`Error removing localStorage item ${key}:`, err);
          }
        }
      });

      // 2. Only clear cookies related to settings
      const allCookies = Cookies.get();
      const cookieKeys = Object.keys(allCookies);
      console.log('Checking cookies for settings reset:', cookieKeys.length, 'items found');

      cookieKeys.forEach((key) => {
        if (settingsCookies.includes(key)) {
          try {
            console.log(`Removing settings-related cookie: ${key}`);
            Cookies.remove(key);
          } catch (err) {
            console.error(`Error removing cookie ${key}:`, err);
          }
        }
      });

      console.log('Settings reset completed successfully');

      // Close the dialog first
      setShowResetInlineConfirm(false);

      // Show success message and reload
      toast.success('Settings have been reset to default values');

      // Use setTimeout to ensure the toast is shown before reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Reset error:', error);
      setShowResetInlineConfirm(false);
      toast.error('Failed to reset settings: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAllChats = async () => {
    setIsDeleting(true);

    try {
      // Clear chat history from localStorage
      localStorage.removeItem('bolt_chat_history');

      // Clear chats from IndexedDB
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats and delete them one by one
      const chats = await getAll(db as IDBDatabase);
      const deletePromises = chats.map((chat) => deleteById(db as IDBDatabase, chat.id));
      await Promise.all(deletePromises);

      // Close the dialog first
      setShowDeleteInlineConfirm(false);

      // Then show the success message
      toast.success('Chat history deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      setShowDeleteInlineConfirm(false);
      toast.error('Failed to delete chat history');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler for when granular export is requested
  const handleGranularExport = () => {
    setShowGranularExport(true);
  };

  // Handler for when granular export is confirmed with selected categories
  const handleGranularExportConfirm = (selectedCategories: string[]) => {
    console.log('Exporting selected categories:', selectedCategories);
    handleExportSettings(selectedCategories);
  };

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
      <input ref={apiKeyFileInputRef} type="file" accept=".json" onChange={handleImportAPIKeys} className="hidden" />

      {/* Progress Indicators */}
      <ProgressIndicator
        isActive={showExportProgress}
        operation="export"
        progressPercentage={exportProgress}
        onComplete={handleExportComplete}
      />

      <ProgressIndicator
        isActive={showImportProgress}
        operation="import"
        progressPercentage={importProgress}
        onComplete={handleImportComplete}
      />

      {/* Import Validators */}
      <ImportValidator
        isOpen={showSettingsValidator}
        onClose={() => setShowSettingsValidator(false)}
        onConfirm={handleConfirmSettingsValidation}
        onCancel={handleCancelValidation}
        issues={validationIssues}
        fileName={pendingImportFile?.name}
      />

      <ImportValidator
        isOpen={showApiKeysValidator}
        onClose={() => setShowApiKeysValidator(false)}
        onConfirm={handleConfirmApiKeysValidation}
        onCancel={handleCancelValidation}
        issues={validationIssues}
        fileName={pendingImportFile?.name}
      />

      {/* Granular Export Modal */}
      <GranularExportModal
        isOpen={showGranularExport}
        onClose={() => setShowGranularExport(false)}
        onExport={handleGranularExportConfirm}
      />

      {/* Reset Settings Dialog */}
      <DialogRoot open={showResetInlineConfirm} onOpenChange={setShowResetInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="i-ph:warning-circle-fill w-5 h-5 text-yellow-500" />
              <DialogTitle className="text-bolt-elements-textPrimary">Reset All Settings?</DialogTitle>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-2">
              This will reset all your settings to their default values. This action cannot be undone.
            </p>
            <div className="flex justify-end items-center gap-3 mt-6">
              <DialogClose asChild>
                <button className="px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover">
                  Cancel
                </button>
              </DialogClose>
              <motion.button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover"
                onClick={handleResetSettings}
                disabled={isResetting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isResetting ? (
                  <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                ) : (
                  <div className="i-ph:arrow-counter-clockwise w-4 h-4" />
                )}
                Reset Settings
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={showDeleteInlineConfirm} onOpenChange={setShowDeleteInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="i-ph:warning-circle-fill w-5 h-5 text-bolt-elements-button-danger-text" />
              <DialogTitle className="text-bolt-elements-textPrimary">Delete All Chats?</DialogTitle>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-2">
              This will permanently delete all your chat history. This action cannot be undone.
            </p>
            <div className="flex justify-end items-center gap-3 mt-6">
              <DialogClose asChild>
                <button className="px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover">
                  Cancel
                </button>
              </DialogClose>
              <motion.button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover"
                onClick={handleDeleteAllChats}
                disabled={isDeleting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isDeleting ? (
                  <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                ) : (
                  <div className="i-ph:trash w-4 h-4" />
                )}
                Delete All
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Chat History Section */}
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:chat-circle-duotone w-5 h-5 text-bolt-elements-button-primary-text" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Chat History</h3>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">Export or delete all your chat history.</p>
        <div className="flex gap-4">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportAllChats}
          >
            <div className="i-ph:download-simple w-4 h-4" />
            Export All Chats
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text text-sm hover:bg-bolt-elements-button-danger-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDeleteInlineConfirm(true)}
          >
            <div className="i-ph:trash w-4 h-4" />
            Delete All Chats
          </motion.button>
        </div>
      </motion.div>

      {/* Settings Backup Section */}
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:gear-duotone w-5 h-5 text-bolt-elements-button-primary-text" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Settings Backup</h3>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Export your settings to a JSON file or import settings from a previously exported file.
        </p>
        <div className="flex flex-wrap gap-4">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExportSettings()}
          >
            <div className="i-ph:download-simple w-4 h-4" />
            Export All Settings
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGranularExport}
          >
            <div className="i-ph:funnel-simple w-4 h-4" />
            Custom Export
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="i-ph:upload-simple w-4 h-4" />
            Import Settings
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text text-sm hover:bg-bolt-elements-button-danger-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowResetInlineConfirm(true)}
          >
            <div className="i-ph:arrow-counter-clockwise w-4 h-4" />
            Reset Settings
          </motion.button>
        </div>

        {/* Export History Panel */}
        <ExportHistoryPanel />
      </motion.div>

      {/* Automatic Backup Section */}
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:clock-clockwise-duotone w-5 h-5 text-bolt-elements-button-primary-text" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Automatic Backup</h3>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Configure automatic backups to save your settings on a schedule.
        </p>

        {/* Auto Backup Panel */}
        <AutoBackupPanel />

        {/* Auto Backup List */}
        <AutoBackupList />
      </motion.div>

      {/* API Keys Management Section */}
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:key-duotone w-5 h-5 text-bolt-elements-button-primary-text" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">API Keys Management</h3>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Import API keys from a JSON file or download a template to fill in your keys.
        </p>
        <div className="flex gap-4">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
          >
            {isDownloadingTemplate ? (
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
            ) : (
              <div className="i-ph:download-simple w-4 h-4" />
            )}
            Download Template
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-sm hover:bg-bolt-elements-button-primary-backgroundHover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => apiKeyFileInputRef.current?.click()}
            disabled={isImportingKeys}
          >
            {isImportingKeys ? (
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
            ) : (
              <div className="i-ph:upload-simple w-4 h-4" />
            )}
            Import API Keys
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// Helper functions for export
const safeGetItem = (key: string): any => {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    // Try to parse as JSON, fall back to raw value
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (err) {
    console.error(`Error getting ${key} from localStorage:`, err);
    return null;
  }
};

const getAllLocalStorage = (): Record<string, any> => {
  const result: Record<string, any> = {};

  try {
    Object.keys(localStorage).forEach((key) => {
      try {
        const value = localStorage.getItem(key);

        if (value) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      } catch (err) {
        console.error(`Error processing localStorage key ${key}:`, err);
      }
    });
  } catch (err) {
    console.error('Error getting all localStorage items:', err);
  }

  return result;
};

const getGitHubConnections = (cookies: Record<string, string>): Record<string, any> => {
  const gitConnections: Record<string, any> = {};

  Object.keys(cookies).forEach((key) => {
    if (key.startsWith('git:')) {
      try {
        gitConnections[key] = JSON.parse(cookies[key]);
      } catch {
        gitConnections[key] = cookies[key];
      }
    }
  });

  return gitConnections;
};
