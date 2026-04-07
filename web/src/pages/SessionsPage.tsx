import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Ban } from 'lucide-react';

interface Session {
  id: string;
  user_id: string;
  username: string | null;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    api.get<PaginatedResponse<Session>>('/api/sessions').then(d => {
      setSessions(d.items);
      setTotal(d.total);
    }).catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    await api.del(`/api/sessions/${id}`);
    load();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Active Sessions ({total})</h2>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Device</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Created</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{s.username || s.user_id}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.device_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {s.is_active ? 'Active' : 'Expired'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => revoke(s.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Revoke session">
                    <Ban size={13} />
                    Revoke
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
