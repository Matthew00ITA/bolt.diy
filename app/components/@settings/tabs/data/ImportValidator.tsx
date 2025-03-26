import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DialogRoot, Dialog, DialogTitle, DialogClose } from '~/components/ui/Dialog';

export type ValidationIssue = {
  type: 'error' | 'warning';
  message: string;
  field?: string;
  details?: string;
};

interface ImportValidatorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  issues: ValidationIssue[];
  fileName?: string;
}

export default function ImportValidator({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  issues,
  fileName,
}: ImportValidatorProps) {
  const [expandedIssues, setExpandedIssues] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Reset expanded state when issues change
    setExpandedIssues({});
  }, [issues]);

  const toggleIssue = (index: number) => {
    setExpandedIssues((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const errorCount = issues.filter((issue) => issue.type === 'error').length;
  const warningCount = issues.filter((issue) => issue.type === 'warning').length;
  const canProceed = errorCount === 0;

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog className="sm:max-w-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {errorCount > 0 ? (
              <div className="i-ph:warning-circle-fill w-5 h-5 text-bolt-elements-button-danger-text" />
            ) : warningCount > 0 ? (
              <div className="i-ph:warning-fill w-5 h-5 text-yellow-500" />
            ) : (
              <div className="i-ph:check-circle-fill w-5 h-5 text-bolt-elements-icon-success" />
            )}
            <DialogTitle className="text-bolt-elements-textPrimary">
              {errorCount > 0
                ? 'Import Validation Failed'
                : warningCount > 0
                  ? 'Import Validation Warnings'
                  : 'Import Validation Successful'}
            </DialogTitle>
          </div>

          <div className="mb-4">
            <p className="text-sm text-bolt-elements-textSecondary">
              {fileName ? `File: ${fileName}` : 'Validating import data'}
            </p>
            <div className="flex gap-3 mt-2">
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text px-2 py-1 rounded-full">
                  <div className="i-ph:x-circle w-3 h-3" />
                  {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-full">
                  <div className="i-ph:warning w-3 h-3" />
                  {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
                </span>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                  <div className="i-ph:check-circle w-3 h-3" />
                  Validation Passed
                </span>
              )}
            </div>
          </div>

          {issues.length > 0 && (
            <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden mb-6 max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-bolt-elements-borderColor">
                {issues.map((issue, index) => (
                  <div key={index} className="bg-bolt-elements-bg-depth-1">
                    <div
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-bolt-elements-item-backgroundActive ${
                        issue.type === 'error'
                          ? 'border-l-2 border-bolt-elements-button-danger-text'
                          : 'border-l-2 border-yellow-500'
                      }`}
                      onClick={() => toggleIssue(index)}
                    >
                      {issue.type === 'error' ? (
                        <div className="i-ph:x-circle-fill w-4 h-4 text-bolt-elements-button-danger-text flex-shrink-0" />
                      ) : (
                        <div className="i-ph:warning-fill w-4 h-4 text-yellow-500 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-bolt-elements-textPrimary">{issue.message}</span>
                          <div
                            className={`i-ph:caret-${
                              expandedIssues[index] ? 'up' : 'down'
                            } w-4 h-4 text-bolt-elements-textTertiary`}
                          />
                        </div>
                        {issue.field && (
                          <span className="text-xs text-bolt-elements-textTertiary mt-1 block">
                            Field: {issue.field}
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedIssues[index] && issue.details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 py-2 bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor"
                      >
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-bolt-elements-textSecondary">
                          {issue.details}
                        </pre>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <button
                className="px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover"
                onClick={onCancel}
              >
                Cancel
              </button>
            </DialogClose>
            {canProceed && (
              <motion.button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover text-sm"
                onClick={onConfirm}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="i-ph:check w-4 h-4" />
                Proceed Anyway
              </motion.button>
            )}
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
