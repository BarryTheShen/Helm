import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, ToggleLeft, ToggleRight, Trash2, Pencil, X, Loader2 } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  action_config: Record<string, unknown> | null;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

const TRIGGER_TYPES = [
  { value: 'event_created', label: 'Event Created' },
  { value: 'event_updated', label: 'Event Updated' },
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'message_received', label: 'Message Received' },
  { value: 'data_changed', label: 'Data Changed' },
  { value: 'server_event', label: 'Server Event' },
];

const TRIGGER_CONFIG_PLACEHOLDERS: Record<string, string> = {
  schedule: '{\n  "interval": "daily",\n  "time": "09:00"\n}',
  data_changed: '{\n  "data_source": "notes",\n  "event": "created"\n}',
  server_event: '{\n  "event_name": "webhook_received"\n}',
  event_created: '{\n  "calendar_id": "primary"\n}',
  event_updated: '{\n  "calendar_id": "primary"\n}',
  form_submitted: '{\n  "form_id": "feedback-form"\n}',
  message_received: '{\n  "channel": "general"\n}',
};

const ACTION_CONFIG_PLACEHOLDER = '{\n  "actions": [\n    {\n      "type": "show_notification",\n      "message": "Workflow triggered!",\n      "notificationType": "info"\n    }\n  ]\n}';

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: '', trigger_type: 'schedule', trigger_config: '', action_config: '' });
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', trigger_config: '', action_config: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<Workflow | null>(null);

  const load = () => {
    setLoading(true);
    api.get<PaginatedResponse<Workflow>>('/api/workflows').then(d => setWorkflows(d.items)).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const createWorkflow = async () => {
    try {
      const body: Record<string, unknown> = { name: newWorkflow.name, trigger_type: newWorkflow.trigger_type };
      if (newWorkflow.trigger_config.trim()) body.trigger_config = JSON.parse(newWorkflow.trigger_config);
      if (newWorkflow.action_config.trim()) body.action_config = JSON.parse(newWorkflow.action_config);
      await api.post('/api/workflows', body);
      setShowCreate(false);
      setNewWorkflow({ name: '', trigger_type: 'schedule', trigger_config: '', action_config: '' });
      showSuccess('Workflow created successfully');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow');
    }
  };

  const toggleActive = async (wf: Workflow) => {
    try {
      await api.put(`/api/workflows/${wf.id}`, { is_active: !wf.is_active });
      showSuccess(`Workflow ${wf.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEdit = (wf: Workflow) => {
    setEditingWorkflow(wf);
    setEditForm({
      name: wf.name,
      trigger_config: wf.trigger_config ? JSON.stringify(wf.trigger_config, null, 2) : '',
      action_config: wf.action_config ? JSON.stringify(wf.action_config, null, 2) : '',
    });
  };

  const saveEdit = async () => {
    if (!editingWorkflow) return;
    try {
      const body: Record<string, unknown> = { name: editForm.name };
      if (editForm.trigger_config.trim()) body.trigger_config = JSON.parse(editForm.trigger_config);
      if (editForm.action_config.trim()) body.action_config = JSON.parse(editForm.action_config);
      await api.put(`/api/workflows/${editingWorkflow.id}`, body);
      setEditingWorkflow(null);
      showSuccess('Workflow updated successfully');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update workflow');
    }
  };

  const deleteWorkflow = async (wf: Workflow) => {
    try {
      await api.del(`/api/workflows/${wf.id}`);
      setDeleteConfirm(null);
      showSuccess('Workflow deleted');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete workflow');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Workflows</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Create Workflow
        </button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">{success}</div>}

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input placeholder="Workflow name" value={newWorkflow.name} onChange={e => setNewWorkflow(w => ({ ...w, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trigger Type</label>
              <select value={newWorkflow.trigger_type} onChange={e => setNewWorkflow(w => ({ ...w, trigger_type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trigger Config (JSON, optional)</label>
              <textarea value={newWorkflow.trigger_config} onChange={e => setNewWorkflow(w => ({ ...w, trigger_config: e.target.value }))}
                placeholder={TRIGGER_CONFIG_PLACEHOLDERS[newWorkflow.trigger_type] || '{}'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-y" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action Config (JSON, optional)</label>
              <textarea value={newWorkflow.action_config} onChange={e => setNewWorkflow(w => ({ ...w, action_config: e.target.value }))}
                placeholder={ACTION_CONFIG_PLACEHOLDER}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-y" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors">Cancel</button>
            <button onClick={createWorkflow} disabled={!newWorkflow.name.trim()} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors">Create</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading workflows...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Trigger</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Runs</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Last Run</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No workflows yet. Create one to get started.</td></tr>
              ) : workflows.map(w => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{w.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{w.trigger_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${w.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{w.run_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{w.last_run_at ? new Date(w.last_run_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(w)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit workflow">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => toggleActive(w)} className={`p-1.5 rounded transition-colors ${w.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={w.is_active ? 'Deactivate' : 'Activate'}>
                      {w.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => setDeleteConfirm(w)} className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors" title="Delete workflow">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Workflow</h3>
              <button onClick={() => setEditingWorkflow(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                <input value={editingWorkflow.trigger_type} disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500" />
                <p className="text-xs text-gray-400 mt-1">Trigger type cannot be changed after creation</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Config (JSON)</label>
                <textarea value={editForm.trigger_config} onChange={e => setEditForm(f => ({ ...f, trigger_config: e.target.value }))}
                  placeholder={TRIGGER_CONFIG_PLACEHOLDERS[editingWorkflow.trigger_type] || '{}'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Config (JSON)</label>
                <textarea value={editForm.action_config} onChange={e => setEditForm(f => ({ ...f, action_config: e.target.value }))}
                  placeholder={ACTION_CONFIG_PLACEHOLDER}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y" />
                <p className="text-xs text-gray-400 mt-1">Define what happens when the workflow triggers. Use the action catalog for available action types.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingWorkflow(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={!editForm.name.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Workflow?</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete &ldquo;{deleteConfirm.name}&rdquo;. This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={() => deleteWorkflow(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
