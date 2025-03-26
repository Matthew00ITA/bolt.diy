import { useState } from 'react';
import { motion } from 'framer-motion';
import { DialogRoot, DialogClose, Dialog, DialogTitle } from '~/components/ui/Dialog';

type SettingsCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'core',
    name: 'Core Settings',
    description: 'User profile, general app settings',
    icon: 'i-ph:gear-duotone',
  },
  {
    id: 'providers',
    name: 'Provider Settings',
    description: 'API providers, selected models',
    icon: 'i-ph:plug-duotone',
  },
  {
    id: 'features',
    name: 'Feature Settings',
    description: 'Feature flags, optimizations',
    icon: 'i-ph:flag-duotone',
  },
  {
    id: 'ui',
    name: 'UI Configuration',
    description: 'Tab setup, visual preferences',
    icon: 'i-ph:layout-duotone',
  },
  {
    id: 'connections',
    name: 'Connections',
    description: 'GitHub, Netlify connections',
    icon: 'i-ph:link-duotone',
  },
  {
    id: 'debug',
    name: 'Debug Settings',
    description: 'Debug flags, error logs',
    icon: 'i-ph:bug-duotone',
  },
  {
    id: 'updates',
    name: 'Update Settings',
    description: 'Update preferences',
    icon: 'i-ph:download-duotone',
  },
];

interface GranularExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selectedCategories: string[]) => void;
}

export default function GranularExportModal({ isOpen, onClose, onExport }: GranularExportModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(SETTINGS_CATEGORIES.map((cat) => cat.id));

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const toggleAll = () => {
    if (selectedCategories.length === SETTINGS_CATEGORIES.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(SETTINGS_CATEGORIES.map((cat) => cat.id));
    }
  };

  const handleExport = () => {
    onExport(selectedCategories);
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog className="sm:max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="i-ph:download-simple w-5 h-5 text-bolt-elements-button-primary-text" />
            <DialogTitle className="text-bolt-elements-textPrimary">Export Settings</DialogTitle>
          </div>

          <p className="text-sm text-bolt-elements-textSecondary mb-4">
            Select which settings categories you want to export:
          </p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-bolt-elements-textPrimary">Toggle All</span>
            <button
              className="text-sm text-bolt-elements-button-primary-text hover:text-bolt-elements-item-contentAccent"
              onClick={toggleAll}
            >
              {selectedCategories.length === SETTINGS_CATEGORIES.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-3 mb-6 max-h-[280px] overflow-y-auto pr-2">
            {SETTINGS_CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={`flex items-start p-3 rounded-lg border ${
                  selectedCategories.includes(category.id)
                    ? 'border-bolt-elements-button-primary-text bg-bolt-elements-item-backgroundAccent'
                    : 'border-bolt-elements-borderColor'
                } cursor-pointer transition-colors`}
                onClick={() => toggleCategory(category.id)}
              >
                <div
                  className={`${category.icon} w-5 h-5 mr-3 mt-0.5 ${
                    selectedCategories.includes(category.id)
                      ? 'text-bolt-elements-button-primary-text'
                      : 'text-bolt-elements-textTertiary'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{category.name}</h4>
                    <div
                      className={`w-4 h-4 rounded ${
                        selectedCategories.includes(category.id)
                          ? 'bg-bolt-elements-button-primary-text flex items-center justify-center'
                          : 'border border-bolt-elements-borderColor'
                      }`}
                    >
                      {selectedCategories.includes(category.id) && <div className="i-ph:check w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary mt-1">{category.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-lg text-sm bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover">
                Cancel
              </button>
            </DialogClose>
            <motion.button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover text-sm"
              onClick={handleExport}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={selectedCategories.length === 0}
            >
              <div className="i-ph:download-simple w-4 h-4" />
              Export Selected
            </motion.button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
