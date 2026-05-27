import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Globe, Trash2, Search, Eye, Upload, Smartphone, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SDUIPreview } from '../components/SDUIPreview';
import { AppPreviewFlow } from '../components/AppPreviewFlow';
import { useResource } from '../hooks/useResource';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_public: boolean;
  created_at: string;
  version_count: number;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  display_name: string;
  created_at: string;
}

interface ModuleInfo {
  module_id: string;
  name: string;
  icon: string;
}

interface TemplateDetail extends Template {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  screen_json: any;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface PaginatedVersions {
  items: TemplateVersion[];
  total: number;
}

const categoryColors: Record<string, string> = {
  custom: 'bg-gray-100 text-gray-600',
  form: 'bg-green-100 text-green-700',
  dashboard: 'bg-purple-100 text-purple-700',
  planner: 'bg-orange-100 text-orange-700',
  tracker: 'bg-cyan-100 text-cyan-700',
};

export function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Preview modal
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetail | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Apply modal
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [applyModuleId, setApplyModuleId] = useState('');
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [newModuleName, setNewModuleName] = useState('');
  const [autoCheckpoint, setAutoCheckpoint] = useState(true);
  const [applying, setApplying] = useState(false);

  // App preview modal
  const [showAppPreview, setShowAppPreview] = useState(false);

  const navigate = useNavigate();

  const { data: templateData, loading, refetch: fetchTemplates } = useResource<PaginatedResponse<Template>>(
    () => {
      let url = '/api/templates';
      const params: string[] = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
      if (params.length > 0) url += '?' + params.join('&');
      return api.get<PaginatedResponse<Template>>(url);
    },
    [search, categoryFilter],
  );

  const templates = templateData?.items ?? [];

  // Fetch module list and versions when the apply modal opens
  useEffect(() => {
    if (!applyingTemplate) return;
    setSelectedVersionId('');
    setTargetMode('existing');
    setApplyModuleId('');
    setNewModuleName('');
    setAutoCheckpoint(true);
    setVersions([]);

    api.get<{ items: ModuleInfo[] }>('/api/sdui/modules')
      .then(data => setModules(data.items || []))
      .catch(() => setModules([]));

    // Fetch versions for this template
    api.get<PaginatedVersions>(`/api/templates/${applyingTemplate}/versions?limit=50&offset=0`)
      .then(data => {
        setVersions(data.items || []);
      })
      .catch(() => setVersions([]));
  }, [applyingTemplate]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await api.del(`/api/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [fetchTemplates]);

  const handlePreview = useCallback(async (id: string) => {
    try {
      const detail = await api.get<TemplateDetail>(`/api/templates/${id}`);
      setPreviewTemplate(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!applyingTemplate) return;

    let targetModuleId = applyModuleId;

    // If "Create new module", create it first
    if (targetMode === 'new') {
      const name = newModuleName.trim();
      if (!name) {
        toast.error('Please enter a module name');
        return;
      }
      try {
        setApplying(true);
        const newModule = await api.post<{ module_id: string; name: string; icon: string }>(
          '/api/sdui/modules',
          { name, icon: '📦' },
        );
        targetModuleId = newModule.module_id;
        toast.success(`Module "${name}" created`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create module');
        setApplying(false);
        return;
      }
    } else {
      if (!targetModuleId) {
        toast.error('Please select a target module');
        return;
      }
    }

    // Apply template
    try {
      setApplying(true);
      await api.post(`/api/templates/${applyingTemplate}/apply`, {
        module_id: targetModuleId,
        version_id: selectedVersionId || null,
        auto_checkpoint: autoCheckpoint,
      });
      const moduleName = targetMode === 'new'
        ? newModuleName.trim()
        : modules.find(m => m.module_id === targetModuleId)?.name || targetModuleId;
      toast.success(`Template applied to "${moduleName}" as draft`);
      setApplyingTemplate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  }, [applyingTemplate, targetMode, applyModuleId, newModuleName, selectedVersionId, autoCheckpoint, modules]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Templates</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAppPreview(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md"
          >
            <Smartphone size={16} />
            Preview Whole App
          </button>
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Open Editor
          </button>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">All categories</option>
          <option value="dashboard">Dashboard</option>
          <option value="planner">Planner</option>
          <option value="tracker">Tracker</option>
          <option value="form">Form</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No templates found. Create one from the Module Editor.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} data-testid="template-card" className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold">{t.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePreview(t.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Preview"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => setApplyingTemplate(t.id)}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Apply to module"
                  >
                    <Upload size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="text-gray-500 text-sm mb-3">{t.description || 'No description'}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || 'bg-gray-100 text-gray-600'}`}>
                    {t.category}
                  </span>
                  {t.is_public && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                      <Globe size={11} />
                      Public
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full text-xs font-medium">
                    <Layers size={11} />
                    {t.version_count} {t.version_count === 1 ? 'version' : 'versions'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{formatDate(t.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowJson(v => !v)} className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${showJson ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-300 hover:bg-gray-100'}`}>{'{}'}</button>
                <button onClick={() => { setPreviewTemplate(null); setShowJson(false); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">{previewTemplate.description || 'No description'}</p>
            <p className="text-xs text-gray-400 mb-3">
              <Layers size={12} className="inline mr-1" />
              {previewTemplate.version_count} {previewTemplate.version_count === 1 ? 'version' : 'versions'}
            </p>
            {showJson ? (
              <pre className="mt-2 text-xs font-mono bg-gray-50 p-3 rounded overflow-auto max-h-96 mb-4">{JSON.stringify(previewTemplate.screen_json, null, 2)}</pre>
            ) : (
              <SDUIPreview json={previewTemplate.screen_json} maxWidth={390} maxHeight={600} />
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => {
                  setPreviewTemplate(null);
                  setShowJson(false);
                  setApplyingTemplate(previewTemplate.id);
                }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Apply to Module
              </button>
              <button
                onClick={() => { setPreviewTemplate(null); setShowJson(false); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {applyingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="template-apply-modal">
          <div className="bg-white rounded-lg p-6 w-[480px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Apply Template</h3>

            {/* Version selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <select
                data-testid="template-version-select"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">Latest (current template)</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.display_name}
                  </option>
                ))}
              </select>
              {versions.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No saved versions — the current template will be applied.</p>
              )}
            </div>

            {/* Target selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Target</label>
              <div className="flex gap-3 mb-3">
                <button
                  type="button"
                  data-testid="template-target-existing"
                  onClick={() => setTargetMode('existing')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    targetMode === 'existing'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Apply to Existing Module
                </button>
                <button
                  type="button"
                  data-testid="template-target-new"
                  onClick={() => setTargetMode('new')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    targetMode === 'new'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Create New Module
                </button>
              </div>

              {targetMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Module</label>
                  <select
                    data-testid="template-module-select"
                    value={applyModuleId}
                    onChange={(e) => setApplyModuleId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">Select a module...</option>
                    {modules.map(m => (
                      <option key={m.module_id} value={m.module_id}>
                        {m.icon ? `${m.icon} ` : ''}{m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Module Name</label>
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="Enter module name..."
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              )}
            </div>

            {/* Auto-checkpoint checkbox */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="template-auto-checkpoint"
                  checked={autoCheckpoint}
                  onChange={(e) => setAutoCheckpoint(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Create auto-checkpoint before applying
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-6">
                Saves the current working draft as a checkpoint before applying the template, so you can restore
                the previous state if needed.
              </p>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              This will create a draft on the selected module. The draft must be approved on the mobile app before going live.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                data-testid="template-apply-cancel"
                onClick={() => setApplyingTemplate(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                disabled={applying}
              >
                Cancel
              </button>
              <button
                data-testid="template-apply-submit"
                onClick={handleApply}
                disabled={
                  applying ||
                  (targetMode === 'existing' && !applyModuleId) ||
                  (targetMode === 'new' && !newModuleName.trim())
                }
                className={`px-4 py-2 text-sm rounded-md ${
                  applying || (targetMode === 'existing' && !applyModuleId) || (targetMode === 'new' && !newModuleName.trim())
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {applying ? 'Applying...' : 'Apply as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Preview Modal */}
      {showAppPreview && (
        <AppPreviewFlow onClose={() => setShowAppPreview(false)} />
      )}
    </div>
  );
}
