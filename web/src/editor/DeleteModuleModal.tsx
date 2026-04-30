import { useState } from 'react';
import { api } from '../lib/api';
import { AlertTriangle } from 'lucide-react';

interface DeleteModuleModalProps {
  moduleId: string;
  moduleName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteModuleModal({ moduleId, moduleName, onClose, onSuccess }: DeleteModuleModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== moduleName) {
      setError('Module name does not match');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await api.del(`/api/sdui/modules/${moduleId}`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Delete Module</h3>
            <p className="text-xs text-gray-600">
              This action cannot be undone. This will permanently delete the custom module and all its associated data.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-semibold">{moduleName}</span> to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder={moduleName}
              disabled={deleting}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
              disabled={deleting || confirmText !== moduleName}
            >
              {deleting ? 'Deleting...' : 'Delete Module'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
