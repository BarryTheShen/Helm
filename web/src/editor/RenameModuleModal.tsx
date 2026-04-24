import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AlertCircle } from 'lucide-react';

interface RenameModuleModalProps {
  moduleInstanceId: string;
  currentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface AffectedApp {
  id: string;
  name: string;
}

export function RenameModuleModal({ moduleInstanceId, currentName, onClose, onSuccess }: RenameModuleModalProps) {
  const [newName, setNewName] = useState(currentName);
  const [affectedApps, setAffectedApps] = useState<AffectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Module name cannot be empty');
      return;
    }

    if (trimmedName === currentName) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.updateModuleInstance(moduleInstanceId, { name: trimmedName });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename module');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">Rename Module</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              New Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Enter module name"
              autoFocus
              disabled={saving}
            />
          </div>

          {loading ? (
            <div className="text-xs text-gray-400">Loading affected apps...</div>
          ) : affectedApps.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 font-medium">
                  This will be renamed in the following apps:
                </div>
              </div>
              <ul className="ml-6 space-y-1">
                {affectedApps.map((app) => (
                  <li key={app.id} className="text-xs text-amber-700">
                    • {app.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              This module is not currently used in any apps.
            </div>
          )}

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
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
              disabled={saving || !newName.trim()}
            >
              {saving ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
