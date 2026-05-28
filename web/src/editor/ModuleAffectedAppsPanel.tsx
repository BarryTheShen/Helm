import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface ModuleAffectedAppsPanelProps {
  moduleId: string;
}

export function ModuleAffectedAppsPanel({ moduleId }: ModuleAffectedAppsPanelProps) {
  const [apps, setApps] = useState<{ app_id: string; app_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      setLoading(true);
      setError(null);
      try {
        const usage = await api.get<{ used_by_apps: { app_id: string; app_name: string }[] }>(
          `/api/modules/${moduleId}/usage`,
        );
        if (!cancelled) {
          setApps(usage.used_by_apps ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load affected apps');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  if (loading) {
    return (
      <div className="text-xs text-gray-500" data-testid="module-affected-apps-loading">
        Loading affected apps…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2" data-testid="module-affected-apps-error">
        {error}
      </div>
    );
  }

  return (
    <div data-testid="module-affected-apps">
      <div className="text-xs font-medium text-gray-700 mb-1">Apps using this module</div>
      {apps.length === 0 ? (
        <div className="text-xs text-gray-400">Not referenced by any app.</div>
      ) : (
        <ul className="text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
          {apps.map((app) => (
            <li key={app.app_id} data-testid="module-affected-app-item">
              {app.app_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
