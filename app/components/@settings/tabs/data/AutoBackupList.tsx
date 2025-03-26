import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getAvailableBackups, getBackup, deleteBackup, downloadBackup, BackupStorageType } from './AutoBackupService';
import type { BackupMetadata } from './AutoBackupService';
import Cookies from 'js-cookie';

export default function AutoBackupList() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setIsLoading(true);

    try {
      const available = await getAvailableBackups();
      setBackups(available);
    } catch (error) {
      console.error('Error loading backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (confirmDelete === key) {
      // Actually delete it
      const success = await deleteBackup(key);

      if (success) {
        toast.success('Backup deleted');
        loadBackups();
      } else {
        toast.error('Failed to delete backup');
      }

      setConfirmDelete(null);
    } else {
      // Ask for confirmation
      setConfirmDelete(key);
    }
  };

  const handleRestore = async (key: string) => {
    try {
      const backupData = await getBackup(key);

      if (!backupData) {
        toast.error('Failed to load backup data');
        return;
      }

      // Confirm before restoring
      if (!window.confirm('This will replace your current settings with those from the backup. Continue?')) {
        return;
      }

      // Restore settings based on categories
      const { _meta, ...categories } = backupData;

      // Helper functions for restoration
      const safeSetItem = (key: string, value: any) => {
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (err) {
          console.error(`Error saving ${key} to localStorage:`, err);
        }
      };

      const safeSetCookie = (key: string, value: any) => {
        try {
          Cookies.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (err) {
          console.error(`Error saving ${key} to cookies:`, err);
        }
      };

      // Process each category
      Object.entries(categories).forEach(([_category, data]) => {
        if (!data) {
          return;
        }

        Object.entries(data as Record<string, any>).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            return;
          }

          // Determine if this is a cookie or localStorage item
          if (
            [
              'selectedModel',
              'selectedProvider',
              'providers',
              'tabConfiguration',
              'apiKeys',
              'isDebugEnabled',
              'eventLogs',
              'cachedPrompt',
            ].includes(key)
          ) {
            safeSetCookie(key, value);
          } else {
            safeSetItem(key, value);
          }
        });
      });

      toast.success('Backup restored successfully');

      // Ask user to reload the page to apply changes
      if (window.confirm('Settings restored. Reload the page to apply changes?')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error('Failed to restore backup');
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const success = await downloadBackup(key);

      if (success) {
        toast.success('Backup downloaded');
      } else {
        toast.error('Failed to download backup');
      }
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  if (backups.length === 0) {
    return isLoading ? (
      <div className="mt-4 text-center py-8">
        <div className="i-ph:spinner-gap-bold animate-spin w-6 h-6 mx-auto text-bolt-elements-textSecondary" />
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">Loading backups...</p>
      </div>
    ) : (
      <div className="mt-4 text-center py-8 border border-dashed border-bolt-elements-borderColor rounded-lg">
        <div className="i-ph:clock-clockwise w-8 h-8 mx-auto text-bolt-elements-textTertiary" />
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">No automatic backups found</p>
        <p className="text-xs text-bolt-elements-textTertiary mt-1">
          Enable auto-backup to start creating scheduled backups
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-md font-medium text-bolt-elements-textPrimary mb-2">Available Backups</h4>
      <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-bolt-elements-bg-depth-2">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary">Size</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary">Storage</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-bolt-elements-textSecondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bolt-elements-borderColor">
            {backups.map((backup) => (
              <tr key={backup.key} className="bg-bolt-elements-bg-depth-1 hover:bg-bolt-elements-item-backgroundActive">
                <td className="px-4 py-3 text-sm text-bolt-elements-textPrimary">{formatDate(backup.timestamp)}</td>
                <td className="px-4 py-3 text-sm text-bolt-elements-textSecondary">{formatSize(backup.size)}</td>
                <td className="px-4 py-3 text-sm text-bolt-elements-textSecondary">
                  {backup.storageType === BackupStorageType.INDEXED_DB
                    ? 'IndexedDB'
                    : backup.storageType === BackupStorageType.GOOGLE_DRIVE
                      ? 'Google Drive'
                      : 'localStorage'}
                  {backup.storageType === BackupStorageType.GOOGLE_DRIVE && backup.webViewLink && (
                    <a
                      href={backup.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-bolt-elements-button-primary-text hover:underline"
                    >
                      <span className="inline-flex items-center">
                        <div className="i-ph:arrow-square-out w-3 h-3 mr-1" />
                        View
                      </span>
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    className="p-1 rounded-md text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-background transition-colors"
                    onClick={() => handleRestore(backup.key)}
                    title="Restore this backup"
                  >
                    <div className="i-ph:arrow-counter-clockwise w-4 h-4" />
                  </button>
                  <button
                    className="p-1 rounded-md text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-background transition-colors"
                    onClick={() => handleDownload(backup.key)}
                    title="Download this backup"
                  >
                    <div className="i-ph:download-simple w-4 h-4" />
                  </button>
                  <button
                    className={`p-1 rounded-md transition-colors ${
                      confirmDelete === backup.key
                        ? 'text-bolt-elements-button-danger-text bg-bolt-elements-button-danger-background'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-background'
                    }`}
                    onClick={() => handleDelete(backup.key)}
                    title={confirmDelete === backup.key ? 'Confirm delete' : 'Delete this backup'}
                  >
                    <div className="i-ph:trash w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
