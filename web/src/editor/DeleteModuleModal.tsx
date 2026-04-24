import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AlertTriangle } from 'lucide-react';

interface DeleteModuleModalProps {
  moduleInstanceId: string;
  moduleName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface AffectedApp {
  id: string;
  name: string;
}

export function DeleteModuleModal({ moduleInstanceId, moduleName, onClose, onSuccess }: DeleteModuleModalProps) {
  const [affectedApps, setAffectedApps] = useState<AffectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    const loadAffectedApps = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getModuleInstanceUsage(moduleInstanceId);
        setAffectedApps(response.apps || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load affected apps');
      } finally {
        setLoading(false);
      }
    };

    void loadAffectedApps();
  }, [moduleInstanceId]);

  const handleDelete = async () => {
    if (confirmText !== moduleName) {
      setError('Module name does not match');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await api.deleteModuleInstance(moduleInstanceId);
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
      <div className="bg-white rounded-lg shadow-xl p-5 w-[520px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Delete Module</h3>
            <p className="text-xs text-gray-600">
              This action cannot be undone. This will permanently delete the module and all its associated data.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-xs text-gray-400">Loading affected apps...</div>
          ) : affectedApps.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs text-red-800 font-medium mb-2">
                This will affect the following apps:
              </div>
              <ul className="ml-4 space-y-1">
                {affectedApps.map((app) => (
                  <li key={app.id} className="text-xs text-red-700">
                    • {app.name}
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-red-700">
                The module will be removed from all these apps.
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
              This module is not currently used in any apps.
            </div>
          )}

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
