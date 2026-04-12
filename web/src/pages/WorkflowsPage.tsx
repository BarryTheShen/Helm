import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
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
];

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: '', trigger_type: 'schedule' });

  const load = () => {
    api.get<PaginatedResponse<Workflow>>('/api/workflows').then(d => setWorkflows(d.items)).catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const createWorkflow = async () => {
    try {
      await api.post('/api/workflows', newWorkflow);
      setShowCreate(false);
      setNewWorkflow({ name: '', trigger_type: 'schedule' });
      setError('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow');
    }
  };

  const toggleActive = async (wf: Workflow) => {
    try {
      await api.put(`/api/workflows/${wf.id}`, { is_active: !wf.is_active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteWorkflow = async (wf: Workflow) => {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    try {
      await api.del(`/api/workflows/${wf.id}`);
      setError('');
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

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input placeholder="Workflow name" value={newWorkflow.name} onChange={e => setNewWorkflow(w => ({ ...w, name: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trigger Type</label>
            <select value={newWorkflow.trigger_type} onChange={e => setNewWorkflow(w => ({ ...w, trigger_type: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={createWorkflow} disabled={!newWorkflow.name.trim()} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors">Save</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
            {workflows.map(w => (
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
                  <button onClick={() => toggleActive(w)} className={`p-1.5 rounded transition-colors ${w.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={w.is_active ? 'Deactivate' : 'Activate'}>
                    {w.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => deleteWorkflow(w)} className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors" title="Delete workflow">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
