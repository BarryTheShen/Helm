import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ToggleLeft, ToggleRight } from 'lucide-react';

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

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    api.get<PaginatedResponse<Workflow>>('/api/workflows').then(d => setWorkflows(d.items)).catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (wf: Workflow) => {
    try {
      await api.put(`/api/workflows/${wf.id}`, { is_active: !wf.is_active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Workflows</h2>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Trigger</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Runs</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Last Run</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Toggle</th>
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
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(w)} className={`p-1.5 rounded transition-colors ${w.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={w.is_active ? 'Deactivate' : 'Activate'}>
                    {w.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
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
