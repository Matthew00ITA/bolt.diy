/**
 * Export history entry type
 */
export type ExportHistoryEntry = {
  id: string;
  timestamp: string;
  filename: string;
  categories?: string[];
  size: number;
};

/**
 * Manager for keeping track of export history
 */
export class ExportHistoryManager {
  private static _instance: ExportHistoryManager;
  private static readonly _storageKey = 'bolt_export_history';
  private static readonly _maxHistoryItems = 10;

  /**
   * Add a new export to the history
   */
  static addExport(filename: string, categories?: string[], size?: number): void {
    try {
      const history = this.getHistory();
      const newEntry: ExportHistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        filename,
        categories,
        size: size || 0,
      };

      // Add the new entry at the beginning
      history.unshift(newEntry);

      // Limit the history size
      if (history.length > this._maxHistoryItems) {
        history.splice(this._maxHistoryItems);
      }

      // Save the updated history
      localStorage.setItem(this._storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to add export to history:', error);
    }
  }

  /**
   * Get the export history
   */
  static getHistory(): ExportHistoryEntry[] {
    try {
      const historyJson = localStorage.getItem(this._storageKey);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Failed to get export history:', error);
      return [];
    }
  }

  /**
   * Clear the export history
   */
  static clearHistory(): void {
    try {
      localStorage.removeItem(this._storageKey);
    } catch (error) {
      console.error('Failed to clear export history:', error);
    }
  }

  /**
   * Remove a specific export from history
   */
  static removeExport(exportId: string): void {
    try {
      const history = this.getHistory();
      const updatedHistory = history.filter((entry) => entry.id !== exportId);
      localStorage.setItem(this._storageKey, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to remove export from history:', error);
    }
  }
}
