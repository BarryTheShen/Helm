import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Pencil, X, Eye, EyeOff } from 'lucide-react';

interface Connection {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

interface ConnectionCreate {
  name: string;
  provider: string;
  api_key: string;
}

interface ConnectionUpdate {
  name?: string;
  provider?: string;
  api_key?: string;
}

const providerOptions = [
  { value: 'openweathermap', label: 'OpenWeatherMap' },
  { value: 'newsapi', label: 'NewsAPI' },
  { value: 'custom', label: 'Custom' },
];

const providerBadge: Record<string, string> = {
  openweathermap: 'bg-blue-100 text-blue-700',
  newsapi: 'bg-green-100 text-green-700',
  custom: 'bg-gray-100 text-gray-700',
};

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newConn, setNewConn] = useState<ConnectionCreate>({ name: '', provider: 'openweathermap', api_key: '' });
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [editForm, setEditForm] = useState<ConnectionUpdate>({});
  const [confirmDel, setConfirmDel] = useState<{id: string; name: string; onConfirm: () => void} | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const loadConnections = () => {
    setLoading(true);
    api.get<{ items: Connection[]; total: number }>('/api/connections')
      .then(data => {
        setConnections(data.items);
        setTotal(data.total);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConnections(); }, []);

  const createConnection = async () => {
    if (!newConn.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!newConn.api_key.trim()) {
      setError('API key is required');
      return;
    }
    try {
      await api.post<Connection>('/api/connections', newConn);
      setShowCreate(false);
      setNewConn({ name: '', provider: 'openweathermap', api_key: '' });
      setError('');
      loadConnections();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteConnection = (c: Connection) => {
    setConfirmDel({ id: c.id, name: c.name, onConfirm: async () => {
      try {
        await api.del<void>(`/api/connections/${c.id}`);
        loadConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    }});
  };

  const startEdit = (c: Connection) => {
    setEditingConn(c);
    setEditForm({ name: c.name, provider: c.provider, api_key: c.api_key });
  };

  const saveEdit = async () => {
    if (!editingConn) return;
    try {
      await api.put<Connection>(`/api/connections/${editingConn.id}`, editForm);
      setEditingConn(null);
      setEditForm({});
      setError('');
      loadConnections();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Connections</h1>
          <p className="text-sm text-gray-500 mt-1">Manage API keys for external services</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
          <Plus size={16} />
          Add Connection
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Connection</h3>
              <button onClick={() => { setShowCreate(false); setError(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newConn.name}
                  onChange={e => setNewConn({...newConn, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Weather API"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={newConn.provider}
                  onChange={e => setNewConn({...newConn, provider: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {providerOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={newConn.api_key}
                  onChange={e => setNewConn({...newConn, api_key: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter API key"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); setError(''); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={createConnection} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">Create</button>
            </div>
          </div>
        </div>
      )}

      {editingConn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Connection</h3>
              <button onClick={() => { setEditingConn(null); setEditForm({}); setError(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={editForm.provider ?? ''}
                  onChange={e => setEditForm({...editForm, provider: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {providerOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={editForm.api_key ?? ''}
                  onChange={e => setEditForm({...editForm, api_key: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank to keep current key"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setEditingConn(null); setEditForm({}); setError(''); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No connections yet</p>
          <p className="text-sm">Add your first API connection to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {connections.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${providerBadge[c.provider] || providerBadge.custom}`}>
                      {providerOptions.find(p => p.value === c.provider)?.label || c.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-600 font-mono">
                        {visibleKeys.has(c.id) ? c.api_key : maskKey(c.api_key)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(c.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title={visibleKeys.has(c.id) ? 'Hide key' : 'Show key'}
                      >
                        {visibleKeys.has(c.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteConnection(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4">Delete "{confirmDel.name}"? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={() => { confirmDel.onConfirm(); setConfirmDel(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        Total: {total} connection{total !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
