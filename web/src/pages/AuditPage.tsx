import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Filter } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  has_more: boolean;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-600',
};

function getActionBadgeClass(action: string): string {
  const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
  return key ? actionColors[key] : 'bg-gray-100 text-gray-600';
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filter) params.set('resource_type', filter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    api.get<PaginatedResponse<AuditEntry>>(`/api/audit${qs}`).then(d => {
      setEntries(d.items);
      setTotal(d.total);
    });
  };

  useEffect(() => { load(); }, [filter, dateFrom, dateTo]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Audit Log ({total})</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter size={14} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Resources</option>
            <option value="user">Users</option>
            <option value="session">Sessions</option>
            <option value="event">Events</option>
            <option value="screen">Screens</option>
            <option value="workflow">Workflows</option>
            <option value="template">Templates</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Action</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Resource</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Resource ID</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(e.action_type)}`}>
                    {e.action_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{e.resource_type}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{e.resource_id || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
