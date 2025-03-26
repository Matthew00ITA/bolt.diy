import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  isActive: boolean;
  operation: 'export' | 'import';
  totalSteps?: number;
  currentStep?: number;
  progressPercentage?: number;
  onComplete?: () => void;
}

export default function ProgressIndicator({
  isActive,
  operation,
  totalSteps = 3,
  currentStep = 0,
  progressPercentage,
  onComplete,
}: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);

  // When a specific percentage is provided, use that
  useEffect(() => {
    if (progressPercentage !== undefined) {
      setProgress(progressPercentage);
    }
  }, [progressPercentage]);

  // When steps are provided, calculate percentage
  useEffect(() => {
    if (progressPercentage === undefined && totalSteps > 0) {
      const calculatedProgress = Math.round((currentStep / totalSteps) * 100);
      setProgress(calculatedProgress);
    }
  }, [currentStep, totalSteps, progressPercentage]);

  // When progress reaches 100%, trigger the onComplete callback
  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 500); // Small delay for animation to complete
      return () => clearTimeout(timer);
    }

    return undefined; // Explicit return for the code path when condition is false
  }, [progress, onComplete]);

  // If not active, don't render anything
  if (!isActive) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        className="bg-bolt-elements-bg-depth-1 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-bolt-elements-borderColor"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="mb-4 flex items-center gap-3">
          {operation === 'export' ? (
            <div className="i-ph:download-simple w-5 h-5 text-bolt-elements-button-primary-text" />
          ) : (
            <div className="i-ph:upload-simple w-5 h-5 text-bolt-elements-button-primary-text" />
          )}
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">
            {operation === 'export' ? 'Exporting Settings' : 'Importing Settings'}
          </h3>
        </div>

        <div className="mb-2 flex justify-between items-center">
          <span className="text-sm text-bolt-elements-textSecondary">
            {progress < 100
              ? `${operation === 'export' ? 'Preparing' : 'Processing'} your data...`
              : `${operation === 'export' ? 'Export' : 'Import'} complete!`}
          </span>
          <span className="text-sm font-medium text-bolt-elements-button-primary-text">{progress}%</span>
        </div>

        <div className="h-2 bg-bolt-elements-loader-background rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-bolt-elements-loader-progress"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {progress >= 100 && (
          <motion.div
            className="mt-4 text-center text-sm text-bolt-elements-textSecondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {operation === 'export'
              ? 'Your settings have been exported successfully.'
              : 'Your settings have been imported successfully.'}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
