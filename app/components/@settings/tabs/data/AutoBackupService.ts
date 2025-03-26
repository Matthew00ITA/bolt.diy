import { toast } from 'react-toastify';
import { getAutoBackupSettings, isBackupDue, updateLastBackupDate } from './AutoBackupManager';
import Cookies from 'js-cookie';
import {
  uploadBackupToGoogleDrive,
  downloadBackupFromGoogleDrive,
  deleteGoogleDriveBackup,
  authenticateWithGoogleDrive,
} from './GoogleDriveService';

// Storage key for auto-backups
const AUTO_BACKUP_PREFIX = 'bolt_auto_backup_';
const BACKUP_DB_NAME = 'bolt_backups';
const BACKUP_STORE_NAME = 'auto_backups';

// Storage types enum
export enum BackupStorageType {
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB',
  FILE_SYSTEM = 'fileSystem',
  GOOGLE_DRIVE = 'googleDrive',
}

// Backup metadata type
export interface BackupMetadata {
  key: string;
  timestamp: string;
  size: number;
  storageType: BackupStorageType;
  categories?: string[];
  googleDriveId?: string;
  name?: string;
  webViewLink?: string;
}

/**
 * Performs an automatic backup based on the current settings
 */
export async function performAutoBackup(): Promise<boolean> {
  const settings = getAutoBackupSettings();

  // Check if backup is enabled and due
  if (!settings.enabled || !isBackupDue(settings)) {
    return false;
  }

  try {
    console.log('Auto-backup: Creating scheduled backup...');

    // Create backup data object
    const backupData: Record<string, any> = {
      _meta: {
        version: '2.0',
        exportDate: new Date().toISOString(),
        autoBackup: true,
        categories: settings.categories || 'all',
      },
    };

    // Get all cookies
    const allCookies = Cookies.get();

    // Helper function to add data for a specific category
    const addCategoryData = (category: string) => {
      if (!settings.categories || settings.categories.includes(category)) {
        switch (category) {
          case 'core':
            backupData.core = {
              bolt_user_profile: safeGetItem('bolt_user_profile'),
              bolt_settings: safeGetItem('bolt_settings'),
              bolt_profile: safeGetItem('bolt_profile'),
              theme: safeGetItem('theme'),
            };
            break;

          case 'providers':
            backupData.providers = {
              provider_settings: safeGetItem('provider_settings'),
              apiKeys: allCookies.apiKeys,
              selectedModel: allCookies.selectedModel,
              selectedProvider: allCookies.selectedProvider,
              providers: allCookies.providers,
            };
            break;

          case 'features':
            backupData.features = {
              viewed_features: safeGetItem('bolt_viewed_features'),
              developer_mode: safeGetItem('bolt_developer_mode'),
              contextOptimizationEnabled: safeGetItem('contextOptimizationEnabled'),
              autoSelectTemplate: safeGetItem('autoSelectTemplate'),
              isLatestBranch: safeGetItem('isLatestBranch'),
              isEventLogsEnabled: safeGetItem('isEventLogsEnabled'),
              energySaverMode: safeGetItem('energySaverMode'),
              autoEnergySaver: safeGetItem('autoEnergySaver'),
            };
            break;

          case 'ui':
            backupData.ui = {
              bolt_tab_configuration: safeGetItem('bolt_tab_configuration'),
              tabConfiguration: allCookies.tabConfiguration,
              promptId: safeGetItem('promptId'),
              cachedPrompt: allCookies.cachedPrompt,
            };
            break;

          case 'connections':
            backupData.connections = getConnections(allCookies);
            break;

          case 'debug':
            backupData.debug = {
              isDebugEnabled: allCookies.isDebugEnabled,
              acknowledged_debug_issues: safeGetItem('bolt_acknowledged_debug_issues'),
              acknowledged_connection_issue: safeGetItem('bolt_acknowledged_connection_issue'),
              error_logs: safeGetItem('error_logs'),
              bolt_read_logs: safeGetItem('bolt_read_logs'),
              eventLogs: allCookies.eventLogs,
            };
            break;

          case 'updates':
            backupData.updates = {
              update_settings: safeGetItem('update_settings'),
              last_acknowledged_update: safeGetItem('bolt_last_acknowledged_version'),
            };
            break;
        }
      }
    };

    // Add data for each category
    ['core', 'providers', 'features', 'ui', 'connections', 'debug', 'updates'].forEach(addCategoryData);

    // Save the backup
    await saveBackup(backupData);

    // Update last backup date
    updateLastBackupDate();

    console.log('Auto-backup: Created successfully');

    /*
     * Optional: Show a toast message
     * toast.success('Automatic backup completed');
     */

    return true;
  } catch (error) {
    console.error('Auto-backup: Failed', error);

    // Only show errors if they happen, don't bother the user with success messages
    toast.error('Automatic backup failed');

    return false;
  }
}

/**
 * Gets the preferred storage type from settings or defaults to IndexedDB
 */
function getPreferredStorageType(): BackupStorageType {
  const settings = getAutoBackupSettings();
  const storageType = (settings as any).storageType;

  if (storageType === BackupStorageType.LOCAL_STORAGE) {
    return BackupStorageType.LOCAL_STORAGE;
  }

  if (storageType === BackupStorageType.GOOGLE_DRIVE) {
    return BackupStorageType.GOOGLE_DRIVE;
  }

  // Default to IndexedDB for larger storage
  return BackupStorageType.INDEXED_DB;
}

/**
 * Opens the backup IndexedDB
 */
async function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);

    request.onerror = (_) => {
      reject(new Error('Failed to open backup database'));
    };

    request.onsuccess = (_) => {
      resolve(request.result);
    };

    request.onupgradeneeded = (_) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Saves a backup using the preferred storage method
 */
async function saveBackup(data: Record<string, any>): Promise<void> {
  const settings = getAutoBackupSettings();
  const timestamp = new Date().toISOString();
  const backupKey = `${AUTO_BACKUP_PREFIX}${timestamp}`;
  const jsonData = JSON.stringify(data);
  const storageType = getPreferredStorageType();

  try {
    // Determine storage type and save accordingly
    if (storageType === BackupStorageType.LOCAL_STORAGE) {
      await saveToLocalStorage(backupKey, jsonData);
    } else if (storageType === BackupStorageType.GOOGLE_DRIVE) {
      const filename = `bolt-backup-${timestamp.replace(/:/g, '-')}.json`;
      const driveBackup = await uploadBackupToGoogleDrive(data, filename);

      if (driveBackup) {
        // Store a reference to the Google Drive backup
        await saveToIndexedDB(backupKey, jsonData, data._meta?.categories, {
          googleDriveId: driveBackup.id,
          size: parseInt(driveBackup.size, 10) || 0,
          name: driveBackup.name,
          webViewLink: driveBackup.webViewLink,
        });
        console.log(`Auto-backup: Saved to Google Drive with ID ${driveBackup.id}`);
      } else {
        throw new Error('Failed to upload to Google Drive');
      }
    } else {
      await saveToIndexedDB(backupKey, jsonData, data._meta?.categories);
    }

    // Manage backup limits regardless of storage method
    await enforceBackupLimits(settings.maxBackups);
  } catch (error) {
    console.error('Auto-backup: Error saving backup', error);
    throw error;
  }
}

/**
 * Saves a backup to localStorage
 */
async function saveToLocalStorage(key: string, jsonData: string): Promise<void> {
  try {
    localStorage.setItem(key, jsonData);
    console.log(`Auto-backup: Saved to localStorage with key ${key}`);
  } catch (error) {
    // If localStorage fails due to quota, try IndexedDB instead
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      console.warn('Auto-backup: localStorage quota exceeded, falling back to IndexedDB');
      await saveToIndexedDB(key, jsonData);
    } else {
      throw error;
    }
  }
}

/**
 * Saves a backup to IndexedDB
 */
async function saveToIndexedDB(
  key: string,
  jsonData: string,
  categories?: string[] | 'all',
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    const db = await openBackupDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([BACKUP_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE_NAME);

      const backup = {
        key,
        data: jsonData,
        timestamp: key.replace(AUTO_BACKUP_PREFIX, ''),
        size: jsonData.length,
        storageType: metadata?.googleDriveId ? BackupStorageType.GOOGLE_DRIVE : BackupStorageType.INDEXED_DB,
        categories,
        createdAt: new Date().toISOString(),
        ...metadata, // Add any additional metadata
      };

      const request = store.put(backup);

      request.onsuccess = () => {
        console.log(`Auto-backup: Saved to IndexedDB with key ${key}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save backup to IndexedDB'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
    throw error;
  }
}

/**
 * Enforces backup limits across all storage types
 */
async function enforceBackupLimits(maxBackups: number): Promise<void> {
  try {
    // Get all backups from all storage types
    const allBackups = await getAvailableBackups();

    // Sort by timestamp (oldest first)
    allBackups.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Delete oldest backups if we exceed the max limit
    if (allBackups.length > maxBackups) {
      const backupsToDelete = allBackups.slice(0, allBackups.length - maxBackups);

      for (const backup of backupsToDelete) {
        await deleteBackup(backup.key);
        console.log(`Auto-backup: Removed old backup ${backup.key} from ${backup.storageType}`);
      }
    }
  } catch (error) {
    console.error('Auto-backup: Error enforcing backup limits', error);
    throw error;
  }
}

/**
 * Gets all available auto backups from all storage methods
 */
export async function getAvailableBackups(): Promise<BackupMetadata[]> {
  try {
    // Get backups from localStorage
    const localStorageBackups = getLocalStorageBackups();

    // Get backups from IndexedDB
    const indexedDBBackups = await getIndexedDBBackups();

    // Get Google Drive backup references
    const googleDriveBackups = getGoogleDriveBackupReferences();

    // Combine and sort by timestamp (newest first)
    return [...localStorageBackups, ...indexedDBBackups, ...googleDriveBackups].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  } catch (error) {
    console.error('Auto-backup: Error getting backups', error);
    return [];
  }
}

/**
 * Gets backups from localStorage
 */
function getLocalStorageBackups(): BackupMetadata[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(AUTO_BACKUP_PREFIX) && !key.includes('_gdrive_ref'))
      .map((key) => {
        const value = localStorage.getItem(key) || '';
        return {
          key,
          timestamp: key.replace(AUTO_BACKUP_PREFIX, ''),
          size: value.length,
          storageType: BackupStorageType.LOCAL_STORAGE,
        };
      });
  } catch (error) {
    console.error('Auto-backup: Error getting localStorage backups', error);
    return [];
  }
}

/**
 * Gets references to Google Drive backups from IndexedDB
 */
function getGoogleDriveBackupReferences(): BackupMetadata[] {
  try {
    /*
     * This will be populated from IndexedDB in getIndexedDBBackups
     * We just need this function as a placeholder
     */
    return [];
  } catch (error) {
    console.error('Auto-backup: Error getting Google Drive backup references', error);
    return [];
  }
}

/**
 * Gets backups from IndexedDB
 */
async function getIndexedDBBackups(): Promise<BackupMetadata[]> {
  try {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      return [];
    }

    const db = await openBackupDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([BACKUP_STORE_NAME], 'readonly');
      const store = transaction.objectStore(BACKUP_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const backups = request.result.map((backup) => ({
          key: backup.key,
          timestamp: backup.timestamp,
          size: backup.size,
          storageType: backup.storageType,
          categories: backup.categories,
        }));

        resolve(backups);
      };

      request.onerror = () => {
        resolve([]);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Auto-backup: Error getting IndexedDB backups', error);

    return [];
  }
}

/**
 * Gets a specific backup
 */
export async function getBackup(key: string): Promise<Record<string, any> | null> {
  try {
    // Try localStorage first
    const localData = localStorage.getItem(key);

    if (localData) {
      return JSON.parse(localData);
    }

    // If not in localStorage, try IndexedDB
    const indexedDBData = await getBackupFromIndexedDB(key);

    // Check if this is a Google Drive reference
    const gdRef = indexedDBData as any;

    if (gdRef && gdRef.googleDriveId) {
      // Authenticate and download from Google Drive
      await authenticateWithGoogleDrive();
      return await downloadBackupFromGoogleDrive(gdRef.googleDriveId);
    }

    return indexedDBData;
  } catch (error) {
    console.error(`Auto-backup: Error getting backup ${key}`, error);
    return null;
  }
}

/**
 * Gets a backup from IndexedDB
 */
async function getBackupFromIndexedDB(key: string): Promise<Record<string, any> | null> {
  try {
    const db = await openBackupDB();

    return new Promise<Record<string, any> | null>((resolve, _reject) => {
      const transaction = db.transaction([BACKUP_STORE_NAME], 'readonly');
      const store = transaction.objectStore(BACKUP_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          resolve(JSON.parse(request.result.data));
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        _reject(new Error(`Failed to get backup ${key} from IndexedDB`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`Auto-backup: Error getting backup from IndexedDB ${key}`, error);

    return null;
  }
}

/**
 * Deletes a specific backup
 */
export async function deleteBackup(key: string): Promise<boolean> {
  try {
    let success = false;

    // Try to delete from localStorage
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      success = true;
    }

    // Check if this is a Google Drive backup in IndexedDB
    const backup = await getBackupFromIndexedDB(key);

    if (backup) {
      const gdRef = backup as any;

      if (gdRef.googleDriveId) {
        // Authenticate and delete from Google Drive
        await authenticateWithGoogleDrive();
        await deleteGoogleDriveBackup(gdRef.googleDriveId);
      }
    }

    // Also try to delete from IndexedDB
    const indexedDBSuccess = await deleteBackupFromIndexedDB(key);

    return success || indexedDBSuccess;
  } catch (error) {
    console.error(`Auto-backup: Error deleting backup ${key}`, error);
    return false;
  }
}

/**
 * Deletes a backup from IndexedDB
 */
async function deleteBackupFromIndexedDB(key: string): Promise<boolean> {
  try {
    const db = await openBackupDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([BACKUP_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        resolve(false);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`Auto-backup: Error deleting backup from IndexedDB ${key}`, error);
    return false;
  }
}

/**
 * Downloads a backup to a file
 */
export async function downloadBackup(key: string): Promise<boolean> {
  try {
    const backup = await getBackup(key);

    if (!backup) {
      return false;
    }

    const jsonData = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    // Format the key to create a reasonable filename
    const timestamp = key.replace(AUTO_BACKUP_PREFIX, '');
    const date = new Date(timestamp).toISOString().replace(/:/g, '-').split('.')[0];

    a.href = url;
    a.download = `bolt-autobackup-${date}.json`;
    a.click();

    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error(`Auto-backup: Error downloading backup ${key}`, error);
    return false;
  }
}

/**
 * Gets GitHub and other connection data
 */
function getConnections(cookies: Record<string, string>): Record<string, any> {
  const connections: Record<string, any> = {
    netlify_connection: safeGetItem('netlify_connection'),
  };

  // Add git connections
  Object.keys(cookies).forEach((key) => {
    if (key.startsWith('git:')) {
      try {
        connections[key] = JSON.parse(cookies[key]);
      } catch {
        connections[key] = cookies[key];
      }
    }
  });

  return connections;
}

/**
 * Safely gets an item from localStorage
 */
function safeGetItem(key: string): any {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`Auto-backup: Error getting localStorage item ${key}`, error);
    return null;
  }
}
