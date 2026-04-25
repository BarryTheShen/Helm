import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../lib/api';
import { Plus, Trash2, Pencil, X, Eye, EyeOff, Tag } from 'lucide-react';

interface CustomProvider {
  value: string;
  label: string;
  category: string;
  isCustom?: boolean;
}

const STORAGE_KEY = 'helm_custom_providers';

const loadCustomProviders = (): CustomProvider[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

const saveCustomProviders = (providers: CustomProvider[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
};

interface Connection {
  id: string;
  name: string;
  provider: string;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

const builtInProviders: CustomProvider[] = [
  { value: 'openweathermap', label: 'OpenWeatherMap', category: 'Weather' },
  { value: 'newsapi', label: 'NewsAPI', category: 'News' },
  { value: 'openai', label: 'OpenAI', category: 'AI' },
  { value: 'anthropic', label: 'Anthropic', category: 'AI' },
  { value: 'google_calendar', label: 'Google Calendar', category: 'Calendar' },
  { value: 'github', label: 'GitHub', category: 'Development' },
  { value: 'stripe', label: 'Stripe', category: 'Payments' },
  { value: 'sendgrid', label: 'SendGrid', category: 'Email' },
  { value: 'twilio', label: 'Twilio', category: 'SMS' },
  { value: 'slack', label: 'Slack', category: 'Communication' },
  { value: 'discord', label: 'Discord', category: 'Communication' },
  { value: 'custom', label: 'Custom API', category: 'Other' },
];

const providerBadge: Record<string, string> = {
  openweathermap: 'bg-blue-100 text-blue-700',
  newsapi: 'bg-green-100 text-green-700',
  openai: 'bg-purple-100 text-purple-700',
  anthropic: 'bg-orange-100 text-orange-700',
  google_calendar: 'bg-red-100 text-red-700',
  github: 'bg-gray-800 text-white',
  stripe: 'bg-indigo-100 text-indigo-700',
  sendgrid: 'bg-blue-100 text-blue-700',
  twilio: 'bg-red-100 text-red-700',
  slack: 'bg-purple-100 text-purple-700',
  discord: 'bg-indigo-100 text-indigo-700',
  custom: 'bg-gray-100 text-gray-700',
};

const getCustomBadgeClass = (value: string) => `bg-teal-100 text-teal-700`;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().min(1, 'Provider is required'),
  api_key: z.string().min(1, 'API key is required'),
});

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().min(1, 'Provider is required'),
  api_key: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

const customTypeSchema = z.object({
  label: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  value: z.string()
    .min(1, 'Type ID is required')
    .max(30, 'Type ID too long')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  category: z.string().min(1, 'Category is required').max(30, 'Category too long'),
});

type CustomTypeFormValues = z.infer<typeof customTypeSchema>;

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const errorClass = 'text-xs text-red-600 mt-1';

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [confirmDel, setConfirmDel] = useState<{id: string; name: string; onConfirm: () => void} | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(loadCustomProviders);
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);

  const customTypeForm = useForm<CustomTypeFormValues>({
    resolver: zodResolver(customTypeSchema),
    defaultValues: { label: '', value: '', category: 'Custom' },
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', provider: 'openweathermap', api_key: '' },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  const loadConnections = () => {
    setLoading(true);
    api.get<{ items: Connection[]; total: number }>('/api/connections')
      .then(data => {
        setConnections(data.items);
        setTotal(data.total);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConnections(); }, []);

  // Combine built-in and custom providers
  const providerOptions: CustomProvider[] = [
    ...builtInProviders,
    ...customProviders,
  ];

  const handleCreateCustomType = customTypeForm.handleSubmit((values) => {
    // Check for duplicate value
    if (providerOptions.some(p => p.value === values.value)) {
      toast.error('A provider with this ID already exists');
      return;
    }

    const newProvider: CustomProvider = {
      ...values,
      isCustom: true,
    };

    const updated = [...customProviders, newProvider];
    setCustomProviders(updated);
    saveCustomProviders(updated);
    setShowCustomTypeModal(false);
    customTypeForm.reset();
    toast.success(`Provider "${values.label}" added`);
  });

  const deleteCustomType = (provider: CustomProvider) => {
    const updated = customProviders.filter(p => p.value !== provider.value);
    setCustomProviders(updated);
    saveCustomProviders(updated);
    toast.success(`Provider "${provider.label}" removed`);
  };

  const getBadgeClass = (providerValue: string): string => {
    return providerBadge[providerValue] || getCustomBadgeClass(providerValue);
  };

  const handleCreate = createForm.handleSubmit(async (values) => {
    try {
      await api.post<Connection>('/api/connections', {
        name: values.name,
        provider: values.provider,
        credentials: { api_key: values.api_key },
      });
      setShowCreate(false);
      createForm.reset();
      toast.success('Connection created');
      loadConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  });

  const deleteConnection = (c: Connection) => {
    setConfirmDel({ id: c.id, name: c.name, onConfirm: async () => {
      try {
        await api.del<void>(`/api/connections/${c.id}`);
        toast.success('Connection deleted');
        loadConnections();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed');
      }
    }});
  };

  const startEdit = (c: Connection) => {
    setEditingConn(c);
    editForm.reset({ name: c.name, provider: c.provider, api_key: '' });
  };

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editingConn) return;
    try {
      const payload: { name?: string; credentials?: { api_key: string } } = {};
      if (values.name) payload.name = values.name;
      if (values.api_key) payload.credentials = { api_key: values.api_key };
      await api.put<Connection>(`/api/connections/${editingConn.id}`, payload);
      setEditingConn(null);
      toast.success('Connection updated');
      loadConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  });

  const toggleKeyVisibility = async (id: string) => {
    if (visibleKeys.has(id)) {
      setVisibleKeys(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      try {
        const detail = await api.get<Connection & { credentials: { api_key: string } }>(`/api/connections/${id}`);
        setConnections(prev => prev.map(c => c.id === id ? { ...c, api_key: detail.credentials.api_key } : c));
        setVisibleKeys(prev => new Set(prev).add(id));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed');
      }
    }
  };

  const maskKey = (key: string | undefined) => {
    if (!key || key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Connections</h1>
          <p className="text-sm text-gray-500 mt-1">Manage API keys for external services</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCustomTypeModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-md transition-colors"
            title="Add custom provider type"
          >
            <Tag size={16} />
            Add Type
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
            <Plus size={16} />
            Add Connection
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Connection</h3>
              <button onClick={() => { setShowCreate(false); createForm.reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input {...createForm.register('name')} className={inputClass} placeholder="My Weather API" />
                {createForm.formState.errors.name && <p className={errorClass}>{createForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select {...createForm.register('provider')} className={inputClass}>
                  {Object.entries(
                    providerOptions.reduce((acc, opt) => {
                      if (!acc[opt.category]) acc[opt.category] = [];
                      acc[opt.category].push(opt);
                      return acc;
                    }, {} as Record<string, typeof providerOptions>)
                  ).map(([category, options]) => (
                    <optgroup key={category} label={category}>
                      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input {...createForm.register('api_key')} type="password" className={inputClass} placeholder="Enter API key" />
                {createForm.formState.errors.api_key && <p className={errorClass}>{createForm.formState.errors.api_key.message}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset(); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Connection Type</h3>
              <button onClick={() => { setShowCustomTypeModal(false); customTypeForm.reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCustomType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type Name</label>
                <input {...customTypeForm.register('label')} className={inputClass} placeholder="e.g., OpenWeatherMap" />
                {customTypeForm.formState.errors.label && <p className={errorClass}>{customTypeForm.formState.errors.label.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type ID</label>
                <input {...customTypeForm.register('value')} className={inputClass} placeholder="e.g., openweather" />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only</p>
                {customTypeForm.formState.errors.value && <p className={errorClass}>{customTypeForm.formState.errors.value.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input {...customTypeForm.register('category')} className={inputClass} placeholder="e.g., Weather" />
                {customTypeForm.formState.errors.category && <p className={errorClass}>{customTypeForm.formState.errors.category.message}</p>}
              </div>

              {customProviders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Types ({customProviders.length})</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                    {customProviders.map(cp => (
                      <div key={cp.value} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{cp.label}</span>
                          <span className="ml-2 text-xs text-gray-500">({cp.value})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCustomType(cp)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove this type"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCustomTypeModal(false); customTypeForm.reset(); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-md">Add Type</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingConn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Connection</h3>
              <button onClick={() => setEditingConn(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input {...editForm.register('name')} className={inputClass} />
                {editForm.formState.errors.name && <p className={errorClass}>{editForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select {...editForm.register('provider')} className={inputClass}>
                  {Object.entries(
                    providerOptions.reduce((acc, opt) => {
                      if (!acc[opt.category]) acc[opt.category] = [];
                      acc[opt.category].push(opt);
                      return acc;
                    }, {} as Record<string, typeof providerOptions>)
                  ).map(([category, options]) => (
                    <optgroup key={category} label={category}>
                      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input {...editForm.register('api_key')} type="password" className={inputClass} placeholder="Leave blank to keep current key" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingConn(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">Save</button>
              </div>
            </form>
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeClass(c.provider)}`}>
                      {providerOptions.find(p => p.value === c.provider)?.label || c.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-600 font-mono">
                        {visibleKeys.has(c.id) ? c.api_key : maskKey(c.api_key)}
                      </code>
                      <button onClick={() => toggleKeyVisibility(c.id)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title={visibleKeys.has(c.id) ? 'Hide key' : 'Show key'}>
                        {visibleKeys.has(c.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => deleteConnection(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 size={14} /></button>
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

