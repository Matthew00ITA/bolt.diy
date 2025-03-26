import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExportHistoryManager, type ExportHistoryEntry } from './ExportHistoryManager';

export default function ExportHistoryPanel() {
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Load history when component mounts
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const exportHistory = ExportHistoryManager.getHistory();
    setHistory(exportHistory);
  };

  const handleRemoveExport = (id: string) => {
    ExportHistoryManager.removeExport(id);
    loadHistory();
  };

  const handleClearHistory = () => {
    if (isConfirmingClear) {
      ExportHistoryManager.clearHistory();
      loadHistory();
      setIsConfirmingClear(false);
    } else {
      setIsConfirmingClear(true);
    }
  };

  const formatDateTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Unknown date';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Export History</h3>
        {history.length > 0 && (
          <motion.button
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              isConfirmingClear
                ? 'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover'
                : 'bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClearHistory}
          >
            {isConfirmingClear ? (
              <>
                <div className="i-ph:trash w-3.5 h-3.5" />
                Confirm Clear
              </>
            ) : (
              <>
                <div className="i-ph:eraser-duotone w-3.5 h-3.5" />
                Clear History
              </>
            )}
          </motion.button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-6 bg-bolt-elements-bg-depth-2 rounded-lg">
          <div className="i-ph:file-export w-8 h-8 mx-auto text-bolt-elements-textTertiary" />
          <p className="mt-2 text-sm text-bolt-elements-textSecondary">No export history yet</p>
          <p className="text-xs text-bolt-elements-textTertiary">
            Export history will be shown here after you export settings
          </p>
        </div>
      ) : (
        <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bolt-elements-bg-depth-2">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary uppercase">
                    Filename
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary uppercase">
                    Categories
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary uppercase">
                    Size
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-bolt-elements-textSecondary uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bolt-elements-borderColor">
                {history.map((entry) => (
                  <tr
                    key={entry.id}
                    className="bg-bolt-elements-bg-depth-1 hover:bg-bolt-elements-item-backgroundActive"
                  >
                    <td className="px-4 py-3 text-sm text-bolt-elements-textPrimary">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-bolt-elements-textSecondary font-mono">
                      {entry.filename.length > 25 ? `${entry.filename.substring(0, 25)}...` : entry.filename}
                    </td>
                    <td className="px-4 py-3">
                      {entry.categories && entry.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.categories.map((category) => (
                            <span
                              key={category}
                              className="inline-flex px-2 py-0.5 rounded-full text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-bolt-elements-textTertiary">All</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-bolt-elements-textSecondary">{formatFileSize(entry.size)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="p-1 rounded-md text-bolt-elements-textTertiary hover:text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-background transition-colors"
                        onClick={() => handleRemoveExport(entry.id)}
                        title="Remove from history"
                      >
                        <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                          <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
                          <path
                            fillRule="evenodd"
                            d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
