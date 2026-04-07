import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Globe, Trash2, Search, Eye, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_public: boolean;
  created_at: string;
}

interface TemplateDetail extends Template {
  screen_json: any;
}

interface PaginatedResponse<T> {
  items: T[];
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview modal
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetail | null>(null);

  // Apply modal
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [applyModuleId, setApplyModuleId] = useState('home');

  const navigate = useNavigate();

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/templates';
      const params: string[] = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
      if (params.length > 0) url += '?' + params.join('&');
      const data = await api.get<PaginatedResponse<Template>>(url);
      setTemplates(data.items || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await api.del(`/api/templates/${id}`);
      showMsg('success', 'Template deleted');
      fetchTemplates();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }, [fetchTemplates, showMsg]);

  const handlePreview = useCallback(async (id: string) => {
    try {
      const detail = await api.get<TemplateDetail>(`/api/templates/${id}`);
      setPreviewTemplate(detail);
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Preview failed');
    }
  }, [showMsg]);

  const handleApply = useCallback(async (templateId: string, moduleId: string) => {
    try {
      await api.post(`/api/templates/${templateId}/apply`, { module_id: moduleId });
      showMsg('success', `Template applied to ${moduleId} as draft`);
      setApplyingTemplate(null);
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Apply failed');
    }
  }, [showMsg]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const renderScreenPreview = (screenJson: any) => {
    if (!screenJson?.rows) return <div className="text-gray-400 text-sm">No content</div>;
    return (
      <div className="space-y-2">
        {screenJson.rows.map((row: any, ri: number) => (
          <div key={ri} className="flex gap-2 p-2 border rounded bg-gray-50">
            {(row.cells || []).map((cell: any, ci: number) => (
              <div key={ci} className="flex-1 text-xs">
                {cell.component ? (
                  <div className="bg-white rounded p-2 border">
                    <span className="font-mono text-blue-600">{cell.component.type}</span>
                    {cell.component.props?.content && (
                      <span className="text-gray-500 ml-1">
                        "{String(cell.component.props.content).slice(0, 30)}"
                      </span>
                    )}
                    {cell.component.props?.label && (
                      <span className="text-gray-500 ml-1">
                        "{String(cell.component.props.label).slice(0, 30)}"
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded p-2 text-gray-400">empty</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Templates</h2>
        <button
          onClick={() => navigate('/editor')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Open Editor
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

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
        <p className="text-gray-500 text-center py-8">No templates found. Create one from the Visual Editor.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
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
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{previewTemplate.description || 'No description'}</p>
            <div className="border rounded-lg p-4 bg-gray-50 mb-4" style={{ maxWidth: 390, margin: '0 auto' }}>
              <div className="text-xs text-gray-400 mb-2 text-center">Mobile Preview (390px)</div>
              {renderScreenPreview(previewTemplate.screen_json)}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setPreviewTemplate(null);
                  setApplyingTemplate(previewTemplate.id);
                }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Apply to Module
              </button>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Module Modal */}
      {applyingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px]">
            <h3 className="text-lg font-semibold mb-4">Apply Template to Module</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Module</label>
              <select
                value={applyModuleId}
                onChange={(e) => setApplyModuleId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="home">🏠 Home</option>
                <option value="chat">💬 Chat</option>
                <option value="modules">🧩 Modules</option>
                <option value="calendar">📅 Calendar</option>
                <option value="forms">📝 Forms</option>
                <option value="alerts">🔔 Alerts</option>
                <option value="settings">⚙️ Settings</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              This will create a draft on the selected module. The draft must be approved on the mobile app before going live.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setApplyingTemplate(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApply(applyingTemplate, applyModuleId)}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Apply as Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
