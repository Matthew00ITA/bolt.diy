import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  getAutoBackupSettings,
  saveAutoBackupSettings,
  calculateNextBackupDate,
  formatRelativeDate,
  BackupFrequency,
  BackupStorageType,
  type AutoBackupSettings,
} from './AutoBackupManager';
import { performAutoBackup } from './AutoBackupService';
import { initGoogleDriveApi, authenticateWithGoogleDrive, revokeGoogleDriveAccess } from './GoogleDriveService';

// Import the same category data from GranularExportModal
const SETTINGS_CATEGORIES = [
  { id: 'core', name: 'Core Settings', description: 'User profile, general app settings' },
  { id: 'providers', name: 'Provider Settings', description: 'API providers, selected models' },
  { id: 'features', name: 'Feature Settings', description: 'Feature flags, optimizations' },
  { id: 'ui', name: 'UI Configuration', description: 'Tab setup, visual preferences' },
  { id: 'connections', name: 'Connections', description: 'GitHub, Netlify connections' },
  { id: 'debug', name: 'Debug Settings', description: 'Debug flags, error logs' },
  { id: 'updates', name: 'Update Settings', description: 'Update preferences' },
];

export default function AutoBackupPanel() {
  const [settings, setSettings] = useState<AutoBackupSettings>(getAutoBackupSettings());
  const [nextBackupDate, setNextBackupDate] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update next backup date when settings change
  useEffect(() => {
    if (settings.enabled) {
      setNextBackupDate(calculateNextBackupDate(settings));
    } else {
      setNextBackupDate(null);
    }
  }, [settings]);

  // Check if backup is due on component mount
  useEffect(() => {
    const checkAndPerformBackup = async () => {
      // Only perform the check if auto-backup is enabled
      if (settings.enabled) {
        const currentSettings = getAutoBackupSettings();

        // Check if a backup is due
        if (currentSettings.enabled && currentSettings.lastBackupDate) {
          console.log('Auto-backup: Checking if backup is due');

          try {
            // Perform the backup if due
            const success = await performAutoBackup();

            if (success) {
              console.log('Auto-backup: Successfully created on startup');
              setSettings(getAutoBackupSettings()); // Refresh settings
            }
          } catch (error) {
            console.error('Auto-backup: Error during startup check', error);
          }
        }
      }
    };

    checkAndPerformBackup();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Save settings when they change
  const handleSaveSettings = (updatedSettings: AutoBackupSettings) => {
    setSettings(updatedSettings);
    saveAutoBackupSettings(updatedSettings);
  };

  // Toggle auto-backup
  const handleToggleAutoBackup = () => {
    const updatedSettings = { ...settings, enabled: !settings.enabled };

    handleSaveSettings(updatedSettings);

    if (updatedSettings.enabled) {
      toast.success('Auto-backup enabled');
    } else {
      toast.info('Auto-backup disabled');
    }
  };

  // Change frequency
  const handleChangeFrequency = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const frequency = event.target.value as BackupFrequency;

    handleSaveSettings({ ...settings, frequency });
  };

  // Change custom days
  const handleChangeCustomDays = (event: React.ChangeEvent<HTMLInputElement>) => {
    const customDays = parseInt(event.target.value, 10);

    if (!isNaN(customDays) && customDays > 0) {
      handleSaveSettings({ ...settings, customDays });
    }
  };

  // Change max backups
  const handleChangeMaxBackups = (event: React.ChangeEvent<HTMLInputElement>) => {
    const maxBackups = parseInt(event.target.value, 10);

    if (!isNaN(maxBackups) && maxBackups > 0) {
      handleSaveSettings({ ...settings, maxBackups });
    }
  };

  // Change storage type
  const handleChangeStorageType = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const storageType = event.target.value as BackupStorageType;

    // If user selects Google Drive, initialize the API and authenticate
    if (storageType === BackupStorageType.GOOGLE_DRIVE) {
      try {
        // Initialize Google Drive API
        const initialized = await initGoogleDriveApi();

        if (!initialized) {
          toast.error('Failed to initialize Google Drive API');
          return;
        }

        // Authenticate with Google Drive
        const authenticated = await authenticateWithGoogleDrive();

        if (!authenticated) {
          toast.error('Google Drive authentication failed');
          return;
        }

        toast.success('Connected to Google Drive');
      } catch (error) {
        console.error('Google Drive setup error:', error);
        toast.error('Failed to set up Google Drive integration');

        return;
      }
    }

    handleSaveSettings({ ...settings, storageType });
  };

  // Toggle a category
  const handleToggleCategory = (categoryId: string) => {
    const categories = settings.categories || SETTINGS_CATEGORIES.map((c) => c.id);
    const updatedCategories = categories.includes(categoryId)
      ? categories.filter((id) => id !== categoryId)
      : [...categories, categoryId];

    handleSaveSettings({
      ...settings,
      categories:
        updatedCategories.length === 0
          ? SETTINGS_CATEGORIES.map((c) => c.id) // If all unchecked, select all
          : updatedCategories,
    });
  };

  // Perform backup now
  const handleBackupNow = async () => {
    const success = await performAutoBackup();

    if (success) {
      toast.success('Backup created successfully');
    } else {
      toast.error('Failed to create backup');
    }

    setSettings(getAutoBackupSettings()); // Refresh settings to get the updated last backup date
  };

  return (
    <div className="mt-6">
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="i-ph:clock-clockwise-duotone w-5 h-5 text-bolt-elements-button-primary-text" />
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Auto-Backup</h3>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover"
              onClick={handleBackupNow}
            >
              <div className="i-ph:floppy-disk w-4 h-4" />
              Backup Now
            </button>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.enabled}
                onChange={handleToggleAutoBackup}
              />
              <div className="w-9 h-5 bg-bolt-elements-bg-depth-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bolt-elements-button-primary-text"></div>
            </label>
          </div>
        </div>

        {settings.enabled && (
          <div className="mt-2">
            <p className="text-sm text-bolt-elements-textSecondary mb-2">
              Next backup: {nextBackupDate ? formatRelativeDate(nextBackupDate) : 'Not scheduled'}
            </p>

            <button
              className="text-sm text-bolt-elements-button-primary-text hover:underline"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide settings' : 'Show settings'}
            </button>

            {isExpanded && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                      Backup Frequency
                    </label>
                    <select
                      className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 py-2 px-3 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-button-primary-text"
                      value={settings.frequency}
                      onChange={handleChangeFrequency}
                    >
                      <option value={BackupFrequency.DAILY}>Daily</option>
                      <option value={BackupFrequency.WEEKLY}>Weekly</option>
                      <option value={BackupFrequency.MONTHLY}>Monthly</option>
                      <option value={BackupFrequency.CUSTOM}>Custom</option>
                    </select>
                  </div>

                  {settings.frequency === BackupFrequency.CUSTOM && (
                    <div>
                      <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                        Custom Interval (days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 py-2 px-3 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-button-primary-text"
                        value={settings.customDays || 7}
                        onChange={handleChangeCustomDays}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                      Max Backups to Keep
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 py-2 px-3 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-button-primary-text"
                      value={settings.maxBackups}
                      onChange={handleChangeMaxBackups}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                      Storage Location
                    </label>
                    <select
                      className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 py-2 px-3 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-button-primary-text"
                      value={settings.storageType}
                      onChange={handleChangeStorageType}
                    >
                      <option value={BackupStorageType.INDEXED_DB}>IndexedDB (Recommended)</option>
                      <option value={BackupStorageType.LOCAL_STORAGE}>localStorage (Limited)</option>
                      <option value={BackupStorageType.GOOGLE_DRIVE}>Google Drive (Cloud)</option>
                    </select>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">
                      {settings.storageType === BackupStorageType.LOCAL_STORAGE
                        ? 'localStorage has limited space (5-10MB)'
                        : settings.storageType === BackupStorageType.GOOGLE_DRIVE
                          ? 'Google Drive stores backups in the cloud for access across devices'
                          : 'IndexedDB supports larger backups (50MB+)'}
                    </p>

                    {settings.storageType === BackupStorageType.GOOGLE_DRIVE && (
                      <div className="mt-2">
                        <button
                          className="text-sm text-bolt-elements-button-danger-text hover:underline"
                          onClick={() => {
                            revokeGoogleDriveAccess();
                            handleSaveSettings({ ...settings, storageType: BackupStorageType.INDEXED_DB });
                            toast.info('Disconnected from Google Drive');
                          }}
                        >
                          Disconnect from Google Drive
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">
                    Settings to Backup
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SETTINGS_CATEGORIES.map((category) => (
                      <div key={category.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`category-${category.id}`}
                          className="rounded border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 text-bolt-elements-button-primary-text focus:ring-bolt-elements-button-primary-backgroundHover"
                          checked={!settings.categories || settings.categories.includes(category.id)}
                          onChange={() => handleToggleCategory(category.id)}
                        />
                        <label htmlFor={`category-${category.id}`} className="text-sm text-bolt-elements-textPrimary">
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {settings.lastBackupDate && (
                  <p className="text-xs text-bolt-elements-textTertiary">
                    Last backup: {new Date(settings.lastBackupDate).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!settings.enabled && (
          <p className="mt-2 text-sm text-bolt-elements-textSecondary">
            Enable auto-backup to automatically save your settings on a schedule.
          </p>
        )}
      </motion.div>
    </div>
  );
}
