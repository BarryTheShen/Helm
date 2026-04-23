import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, type Variable, type VariableCreate, type VariableUpdate, type DataSource, type DataSourceCreate, type DataSourceSchema } from '../lib/api';
import { Plus, Trash2, Pencil, X, Eye } from 'lucide-react';

type Tab = 'variables' | 'data-sources';

const typeBadge: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  number: 'bg-green-100 text-green-700',
  boolean: 'bg-purple-100 text-purple-700',
};

const variableSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['text', 'number', 'boolean']),
  value: z.string(),
  description: z.string().optional(),
});

type VariableFormValues = z.infer<typeof variableSchema>;

const inputClass = 'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const inputClassFull = `w-full ${inputClass}`;
const errorClass = 'text-xs text-red-600 mt-1';

export function VariablesPage() {
  const [tab, setTab] = useState<Tab>('variables');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('variables')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'variables' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Variables
        </button>
        <button
          onClick={() => setTab('data-sources')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'data-sources' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Data Sources
        </button>
      </div>
      {tab === 'variables' ? <VariablesTab /> : <DataSourcesTab />}
    </div>
  );
}

function VariablesTab() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVar, setEditingVar] = useState<Variable | null>(null);
  const [confirmDel, setConfirmDel] = useState<{id: string; name: string; onConfirm: () => void} | null>(null);

  const createForm = useForm<VariableFormValues>({
    resolver: zodResolver(variableSchema),
    defaultValues: { name: '', type: 'text', value: '', description: '' },
  });

  const editForm = useForm<VariableFormValues>({
    resolver: zodResolver(variableSchema),
  });

  const loadVariables = () => {
    setLoading(true);
    api.getVariables().then(data => {
      setVariables(data.items);
      setTotal(data.total);
    }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadVariables(); }, []);

  const handleCreate = createForm.handleSubmit(async (values) => {
    try {
      await api.createVariable(values as VariableCreate);
      setShowCreate(false);
      createForm.reset();
      toast.success('Variable created');
      loadVariables();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  });

  const deleteVariable = (v: Variable) => {
    setConfirmDel({ id: v.id, name: v.name, onConfirm: async () => {
      try {
        await api.deleteVariable(v.id);
        toast.success('Variable deleted');
        loadVariables();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed');
      }
    }});
  };

  const startEdit = (v: Variable) => {
    setEditingVar(v);
    editForm.reset({ name: v.name, value: v.value, type: v.type as VariableFormValues['type'], description: v.description ?? '' });
  };

  const handleEdit = editForm.handleSubmit(async (values) => {
    if (!editingVar) return;
    try {
      await api.updateVariable(editingVar.id, values);
      setEditingVar(null);
      toast.success('Variable updated');
      loadVariables();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  });

  if (loading) return <div className="text-sm text-gray-500">Loading variables…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Variables ({total})</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Add Variable
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input {...createForm.register('name')} placeholder="Name" className={inputClass} />
            {createForm.formState.errors.name && <p className={errorClass}>{createForm.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select {...createForm.register('type')} className={inputClass}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
            <input {...createForm.register('value')} placeholder="Value" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input {...createForm.register('description')} placeholder="Description (optional)" className={inputClass} />
          </div>
          <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors">Save</button>
        </form>
      )}

      {editingVar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[440px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Variable</h3>
              <button onClick={() => setEditingVar(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input {...editForm.register('name')} className={inputClassFull} />
                {editForm.formState.errors.name && <p className={errorClass}>{editForm.formState.errors.name.message}</p>}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select {...editForm.register('type')} className={inputClassFull}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input {...editForm.register('value')} className={inputClassFull} />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input {...editForm.register('description')} className={inputClassFull} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditingVar(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {variables.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No variables yet. Click "Add Variable" to create one.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Value</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variables.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{v.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge[v.type] || 'bg-gray-100 text-gray-600'}`}>{v.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{v.value}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{v.description || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => startEdit(v)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteVariable(v)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
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

      {/* Built-in Variable Reference */}
      <div className="mt-8">
        <h3 className="text-base font-semibold text-gray-700 mb-3">Built-in Variable Reference</h3>
        <p className="text-xs text-gray-400 mb-3">These variables are always available. Custom variables you create above use the <code className="bg-gray-100 px-1 rounded">custom.*</code> namespace.</p>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Scope</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Example</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">user.*</td><td className="px-4 py-2 font-mono text-gray-600">user.name, user.id</td><td className="px-4 py-2 text-gray-500">Current logged-in user info</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">component.&lt;id&gt;.value</td><td className="px-4 py-2 font-mono text-gray-600">component.search-box.value</td><td className="px-4 py-2 text-gray-500">Another component&rsquo;s current state</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">self.value</td><td className="px-4 py-2 font-mono text-gray-600">self.value</td><td className="px-4 py-2 text-gray-500">This component&rsquo;s own value</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">data.*</td><td className="px-4 py-2 font-mono text-gray-600">data.calendar.title</td><td className="px-4 py-2 text-gray-500">Value from a bound data source</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">env.*</td><td className="px-4 py-2 font-mono text-gray-600">env.serverUrl</td><td className="px-4 py-2 text-gray-500">Environment/system settings</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-blue-600">custom.*</td><td className="px-4 py-2 font-mono text-gray-600">custom.appName</td><td className="px-4 py-2 text-gray-500">Your custom variables (defined above)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
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
    </div>
  );
}

function DataSourcesTab() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSource, setNewSource] = useState<DataSourceCreate>({ name: '', type: '', connector: '', config_json: '{}' });
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [editForm, setEditForm] = useState({ name: '', type: '', connector: '', config_json: '' });
  const [schemaModal, setSchemaModal] = useState<DataSourceSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{id: string; name: string; onConfirm: () => void} | null>(null);

  const loadSources = () => {
    setLoading(true);
    api.getDataSources().then(data => {
      setSources(data.items);
      setTotal(data.total);
    }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadSources(); }, []);

  const createSource = async () => {
    if (!newSource.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!newSource.type.trim()) {
      toast.error('Type is required');
      return;
    }
    if (!newSource.connector.trim()) {
      toast.error('Connector is required');
      return;
    }
    try {
      JSON.parse(newSource.config_json ?? '{}');
    } catch {
      toast.error('Config must be valid JSON');
      return;
    }
    try {
      await api.createDataSource(newSource);
      setShowCreate(false);
      setNewSource({ name: '', type: '', connector: '', config_json: '{}' });
      toast.success('Data source created');
      loadSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteSource = (s: DataSource) => {
    setConfirmDel({ id: s.id, name: s.name, onConfirm: async () => {
      try {
        await api.deleteDataSource(s.id);
        toast.success('Data source deleted');
        loadSources();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed');
      }
    }});
  };

  const startEditSource = (s: DataSource) => {
    setEditingSource(s);
    setEditForm({ name: s.name, type: s.type, connector: s.connector, config_json: s.config_json || '{}' });
  };

  const saveEditSource = async () => {
    if (!editingSource) return;
    try {
      JSON.parse(editForm.config_json || '{}');
    } catch {
      toast.error('Config must be valid JSON');
      return;
    }
    try {
      await api.updateDataSource(editingSource.id, editForm);
      setEditingSource(null);
      toast.success('Data source updated');
      loadSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const viewSchema = async (s: DataSource) => {
    setSchemaLoading(true);
    try {
      const schema = await api.getDataSourceSchema(s.id);
      setSchemaModal(schema);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load schema');
    } finally {
      setSchemaLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading data sources…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Data Sources ({total})</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Add Data Source
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input placeholder="Name" value={newSource.name} onChange={e => setNewSource(s => ({ ...s, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={newSource.type} onChange={e => setNewSource(s => ({ ...s, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select type...</option>
                <option value="calendar">Calendar</option>
                <option value="notes">Notes</option>
                <option value="chat">Chat</option>
                <option value="custom">Custom</option>
                <option value="rest">REST / HTTP</option>
                <option value="http_json">HTTP JSON</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Connector</label>
              <input placeholder="Connector" value={newSource.connector} onChange={e => setNewSource(s => ({ ...s, connector: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Config JSON</label>
            <textarea rows={3} placeholder='{"host": "localhost", "port": 5432}' value={newSource.config_json ?? '{}'} onChange={e => setNewSource(s => ({ ...s, config_json: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <button onClick={createSource} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors">Save</button>
          </div>
        </div>
      )}

      {schemaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Data Source Schema</h3>
              <button onClick={() => setSchemaModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Type: {schemaModal.type}</div>
            <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded-md p-4 text-sm font-mono text-gray-700 whitespace-pre-wrap">
              {schemaModal.schema ? JSON.stringify(schemaModal.schema, null, 2) : 'No schema available'}
            </pre>
            <div className="flex justify-end mt-4">
              <button onClick={() => setSchemaModal(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {editingSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Data Source</h3>
              <button onClick={() => setEditingSource(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="calendar">Calendar</option>
                  <option value="notes">Notes</option>
                  <option value="chat">Chat</option>
                  <option value="custom">Custom</option>
                  <option value="rest">REST / HTTP</option>
                  <option value="http_json">HTTP JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connector</label>
                <input value={editForm.connector} onChange={e => setEditForm(f => ({ ...f, connector: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Config JSON</label>
                <textarea value={editForm.config_json} onChange={e => setEditForm(f => ({ ...f, config_json: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingSource(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={saveEditSource} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {sources.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No data sources yet. Click "Add Data Source" to create one.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Connector</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sources.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.connector}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => viewSchema(s)} disabled={schemaLoading} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Schema">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => startEditSource(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteSource(s)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
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
    </div>
  );
}
