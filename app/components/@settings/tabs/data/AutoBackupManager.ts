/**
 * AutoBackupManager for handling scheduled automatic backups of settings
 */

// Storage key for backup settings
const BACKUP_SETTINGS_KEY = 'bolt_auto_backup_settings';

// Default backup interval in days
const DEFAULT_BACKUP_INTERVAL = 7;

// Enum for backup frequency options
export enum BackupFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

// Storage type options
export enum BackupStorageType {
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB',
  GOOGLE_DRIVE = 'googleDrive',
}

// Type for backup settings
export interface AutoBackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  customDays?: number; // Used when frequency is CUSTOM
  lastBackupDate?: string;
  maxBackups: number; // Maximum number of backups to keep
  categories?: string[]; // Which setting categories to back up
  storageType: BackupStorageType; // Where to store the backups
}

// Default backup settings
const DEFAULT_SETTINGS: AutoBackupSettings = {
  enabled: false,
  frequency: BackupFrequency.WEEKLY,
  maxBackups: 5,
  lastBackupDate: undefined,
  storageType: BackupStorageType.INDEXED_DB, // Default to IndexedDB for larger storage
};

/**
 * Gets the current auto backup settings
 */
export function getAutoBackupSettings(): AutoBackupSettings {
  try {
    const storedSettings = localStorage.getItem(BACKUP_SETTINGS_KEY);

    if (storedSettings) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
    }
  } catch (error) {
    console.error('Failed to parse auto backup settings:', error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Saves auto backup settings
 */
export function saveAutoBackupSettings(settings: AutoBackupSettings): void {
  try {
    localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save auto backup settings:', error);
  }
}

/**
 * Calculates the next backup date based on the frequency
 */
export function calculateNextBackupDate(settings: AutoBackupSettings): Date {
  const now = new Date();
  const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate) : new Date(0);

  let daysToAdd = 0;
  let daysToAddValue = 0;

  switch (settings.frequency) {
    case BackupFrequency.DAILY:
      daysToAdd = 1;
      break;
    case BackupFrequency.WEEKLY:
      daysToAdd = 7;
      break;
    case BackupFrequency.MONTHLY:
      daysToAdd = 30;
      break;
    case BackupFrequency.CUSTOM:
      daysToAddValue = settings.customDays || DEFAULT_BACKUP_INTERVAL;
      daysToAdd = daysToAddValue;
      break;
  }

  const nextBackup = new Date(lastBackup);
  nextBackup.setDate(nextBackup.getDate() + daysToAdd);

  // If the next backup date is in the past, set it to now
  if (nextBackup < now) {
    return now;
  }

  return nextBackup;
}

/**
 * Checks if a backup is due
 */
export function isBackupDue(settings: AutoBackupSettings): boolean {
  if (!settings.enabled) {
    return false;
  }

  if (!settings.lastBackupDate) {
    return true; // No backup has been performed yet
  }

  const now = new Date();
  const nextBackup = calculateNextBackupDate(settings);

  return now >= nextBackup;
}

/**
 * Formats a date relative to now (e.g., "in 3 days", "yesterday")
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays === -1) {
    return 'yesterday';
  } else if (diffDays > 0) {
    return `in ${diffDays} days`;
  } else {
    return `${Math.abs(diffDays)} days ago`;
  }
}

/**
 * Updates the last backup date to now
 */
export function updateLastBackupDate(): void {
  const settings = getAutoBackupSettings();
  settings.lastBackupDate = new Date().toISOString();
  saveAutoBackupSettings(settings);
}

/**
 * Returns a friendly string representation of the backup frequency
 */
export function getFrequencyText(settings: AutoBackupSettings): string {
  let days = 0;

  switch (settings.frequency) {
    case BackupFrequency.DAILY:
      return 'Daily';
    case BackupFrequency.WEEKLY:
      return 'Weekly';
    case BackupFrequency.MONTHLY:
      return 'Monthly';
    case BackupFrequency.CUSTOM:
      days = settings.customDays || DEFAULT_BACKUP_INTERVAL;
      return `Every ${days} day${days > 1 ? 's' : ''}`;
    default:
      return 'Unknown frequency';
  }
}
