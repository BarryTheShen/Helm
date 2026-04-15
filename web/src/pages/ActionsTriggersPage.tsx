import { useEffect, useState } from 'react';
import { api, type Trigger, type TriggerCreate, type TriggerUpdate, type TriggerTestResult } from '../lib/api';
import { Plus, Trash2, Pencil, X, Play, ToggleLeft, ToggleRight } from 'lucide-react';

type Tab = 'actions' | 'triggers';

// --- Action catalog (hardcoded — no server discovery yet) ---

interface ActionEntry {
  category: string;
  action: string;
  description: string;
}

const ACTION_CATALOG: ActionEntry[] = [
  { category: 'Navigation', action: 'navigate', description: 'Navigate to a screen or module' },
  { category: 'Navigation', action: 'go_back', description: 'Go back to previous screen' },
  { category: 'Navigation', action: 'open_url', description: 'Open URL in browser' },
  { category: 'Navigation', action: 'open_sheet', description: 'Open bottom sheet' },
  { category: 'Navigation', action: 'dismiss', description: 'Dismiss current modal/sheet' },
  { category: 'Data', action: 'server_action', description: 'Call server-side function' },
  { category: 'Data', action: 'submit_form', description: 'Submit form data to server' },
  { category: 'Data', action: 'refresh_data', description: 'Refresh data source cache' },
  { category: 'State', action: 'set_component_state', description: 'Update component state' },
  { category: 'State', action: 'set_variable', description: 'Update custom variable value' },
  { category: 'State', action: 'toggle', description: 'Toggle boolean state' },
  { category: 'Feedback', action: 'show_notification', description: 'Show notification toast' },
  { category: 'Feedback', action: 'show_alert', description: 'Show alert dialog' },
  { category: 'Feedback', action: 'haptic', description: 'Trigger haptic feedback' },
  { category: 'Feedback', action: 'share', description: 'Open share sheet' },
  { category: 'Utility', action: 'copy_text', description: 'Copy text to clipboard' },
  { category: 'Utility', action: 'delay', description: 'Wait before next action' },
  { category: 'Flow Control', action: 'chain', description: 'Execute multiple actions sequentially' },
  { category: 'Flow Control', action: 'conditional', description: 'Execute actions based on condition' },
];

const categoryBadge: Record<string, string> = {
  Navigation: 'bg-blue-100 text-blue-700',
  Data: 'bg-green-100 text-green-700',
  State: 'bg-purple-100 text-purple-700',
  Feedback: 'bg-amber-100 text-amber-700',
  Utility: 'bg-gray-100 text-gray-600',
  'Flow Control': 'bg-rose-100 text-rose-700',
};

const triggerTypeBadge: Record<string, string> = {
  schedule: 'bg-blue-100 text-blue-700',
  data_change: 'bg-green-100 text-green-700',
  server_event: 'bg-purple-100 text-purple-700',
};

const configPlaceholder: Record<string, string> = {
  schedule: '{"cron": "0 9 * * *"}',
  data_change: '{"source": "users", "field": "status", "condition": "changed"}',
  server_event: '{"event": "user.created"}',
};

export function ActionsTriggersPage() {
  const [tab, setTab] = useState<Tab>('actions');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('actions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'actions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Custom Server Functions
        </button>
        <button
          onClick={() => setTab('triggers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'triggers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Automated Triggers
        </button>
      </div>
      {tab === 'actions' ? <ActionsTab /> : <TriggersTab />}
    </div>
  );
}

function ActionsTab() {
  const [serverFunctions, setServerFunctions] = useState<string[]>([]);
  const [loadingFns, setLoadingFns] = useState(true);

  useEffect(() => {
    setLoadingFns(true);
    api.get<{ functions: string[] }>('/api/actions/functions')
      .then(d => setServerFunctions(d.functions))
      .catch(() => {})
      .finally(() => setLoadingFns(false));
  }, []);

  return (
    <div>
      {/* Registered Server Functions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Registered Server Functions ({serverFunctions.length})</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">These functions are available for <code className="bg-gray-100 px-1 rounded">server_action</code> and <code className="bg-gray-100 px-1 rounded">submit_form</code> actions. They are registered in the backend action registry.</p>
        {loadingFns ? (
          <div className="text-sm text-gray-400 py-4">Loading server functions...</div>
        ) : serverFunctions.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm bg-white rounded-lg shadow-sm">No server functions registered yet.</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Function Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {serverFunctions.map(fn => (
                  <tr key={fn} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{fn}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{`{"type": "server_action", "function": "${fn}"}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Built-in Action Catalog */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Built-in Action Catalog ({ACTION_CATALOG.length})</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3">All available action types that can be used in component rules and trigger action chains.</p>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Action Name</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Category</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ACTION_CATALOG.map(a => (
              <tr key={a.action} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-medium">{a.action}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryBadge[a.category] || 'bg-gray-100 text-gray-600'}`}>{a.category}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TriggersTab() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTrigger, setNewTrigger] = useState<TriggerCreate>({ name: '', trigger_type: 'schedule', config_json: '{}', action_chain_json: '[]', enabled: true });
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);
  const [editForm, setEditForm] = useState<TriggerUpdate>({});
  const [testResult, setTestResult] = useState<TriggerTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [confirmTriggerDel, setConfirmTriggerDel] = useState<{id: string; name: string} | null>(null);

  const loadTriggers = () => {
    setLoading(true);
    api.getTriggers().then(data => {
      setTriggers(data.items);
      setTotal(data.total);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadTriggers(); }, []);

  const createTrigger = async () => {
    if (!newTrigger.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      JSON.parse(newTrigger.config_json ?? '{}');
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    try {
      JSON.parse(newTrigger.action_chain_json ?? '[]');
    } catch {
      setError('Action Chain must be valid JSON');
      return;
    }
    try {
      await api.createTrigger(newTrigger);
      setShowCreate(false);
      setNewTrigger({ name: '', trigger_type: 'schedule', config_json: '{}', action_chain_json: '[]', enabled: true });
      setError('');
      loadTriggers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteTrigger = (t: Trigger) => {
    setConfirmTriggerDel({ id: t.id, name: t.name });
  };

  const confirmDeleteTrigger = async () => {
    if (!confirmTriggerDel) return;
    try {
      await api.deleteTrigger(confirmTriggerDel.id);
      loadTriggers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleEnabled = async (t: Trigger) => {
    try {
      await api.updateTrigger(t.id, { enabled: !t.enabled });
      loadTriggers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEdit = (t: Trigger) => {
    setEditingTrigger(t);
    setEditForm({
      name: t.name,
      trigger_type: t.trigger_type as TriggerCreate['trigger_type'],
      config_json: t.config_json,
      action_chain_json: t.action_chain_json,
      enabled: t.enabled,
    });
  };

  const saveEdit = async () => {
    if (!editingTrigger) return;
    try {
      if (editForm.config_json) JSON.parse(editForm.config_json);
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    try {
      if (editForm.action_chain_json) JSON.parse(editForm.action_chain_json);
    } catch {
      setError('Action Chain must be valid JSON');
      return;
    }
    try {
      await api.updateTrigger(editingTrigger.id, editForm);
      setEditingTrigger(null);
      setError('');
      loadTriggers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const runTest = async (t: Trigger) => {
    setTestLoading(true);
    try {
      const result = await api.testTrigger(t.id);
      setTestResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading triggers…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Automated Triggers ({total})</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Add Trigger
        </button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input placeholder="Trigger name" value={newTrigger.name} onChange={e => setNewTrigger(t => ({ ...t, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={newTrigger.trigger_type} onChange={e => {
                const tt = e.target.value as TriggerCreate['trigger_type'];
                setNewTrigger(t => ({ ...t, trigger_type: tt, config_json: configPlaceholder[tt] || '{}' }));
              }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="schedule">Schedule</option>
                <option value="data_change">Data Change</option>
                <option value="server_event">Server Event</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <label className="text-xs font-medium text-gray-500">Enabled</label>
              <button onClick={() => setNewTrigger(t => ({ ...t, enabled: !t.enabled }))} className="text-gray-500 hover:text-blue-600 transition-colors">
                {newTrigger.enabled ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Config JSON</label>
            <textarea rows={3} placeholder={configPlaceholder[newTrigger.trigger_type] || '{}'} value={newTrigger.config_json ?? '{}'} onChange={e => setNewTrigger(t => ({ ...t, config_json: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action Chain JSON</label>
            <textarea rows={3} placeholder='[{"type": "server_action", "handler": "my_function"}]' value={newTrigger.action_chain_json ?? '[]'} onChange={e => setNewTrigger(t => ({ ...t, action_chain_json: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <button onClick={createTrigger} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingTrigger && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[520px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Trigger</h3>
              <button onClick={() => setEditingTrigger(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={editForm.trigger_type ?? 'schedule'} onChange={e => setEditForm(f => ({ ...f, trigger_type: e.target.value as TriggerCreate['trigger_type'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="schedule">Schedule</option>
                <option value="data_change">Data Change</option>
                <option value="server_event">Server Event</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Config JSON</label>
              <textarea rows={4} value={editForm.config_json ?? '{}'} onChange={e => setEditForm(f => ({ ...f, config_json: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Chain JSON</label>
              <textarea rows={4} value={editForm.action_chain_json ?? '[]'} onChange={e => setEditForm(f => ({ ...f, action_chain_json: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-6 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Enabled</label>
              <button onClick={() => setEditForm(f => ({ ...f, enabled: !f.enabled }))} className="text-gray-500 hover:text-blue-600 transition-colors">
                {editForm.enabled ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} />}
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingTrigger(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Test result modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Trigger Test Result</h3>
              <button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              Status: <span className={testResult.status === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{testResult.status}</span>
            </div>
            <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded-md p-4 text-sm font-mono text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(testResult.result, null, 2)}
            </pre>
            <div className="flex justify-end mt-4">
              <button onClick={() => setTestResult(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No triggers yet. Click "Add Trigger" to create one.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Enabled</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {triggers.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${triggerTypeBadge[t.trigger_type] || 'bg-gray-100 text-gray-600'}`}>{t.trigger_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${t.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                      {t.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => toggleEnabled(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={t.enabled ? 'Disable' : 'Enable'}>
                        {t.enabled ? <ToggleRight size={14} className="text-blue-600" /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => runTest(t)} disabled={testLoading} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Test">
                        <Play size={14} />
                      </button>
                      <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteTrigger(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
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
      {confirmTriggerDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4">Delete "{confirmTriggerDel.name}"? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmTriggerDel(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={() => { confirmDeleteTrigger(); setConfirmTriggerDel(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
