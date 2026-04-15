import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Ban, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';

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
  has_more: boolean;
}

const PAGE_SIZE = 25;

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const load = (pageNum = page) => {
    setLoading(true);
    api.get<PaginatedResponse<Session>>(`/api/sessions?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`).then(d => {
      setSessions(d.items);
      setTotal(d.total);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const revoke = async (id: string) => {
    try {
      await api.del(`/api/sessions/${id}`);
      setSuccess('Session revoked successfully');
      setRevokeConfirm(null);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke session');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filtered = search
    ? sessions.filter(s => (s.username || '').toLowerCase().includes(search.toLowerCase()) || (s.device_name || '').toLowerCase().includes(search.toLowerCase()))
    : sessions;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Active Sessions ({total})</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search users or devices..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        </div>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">{success}</div>}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading sessions...
          </div>
        ) : (
          <>
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
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No sessions found</td></tr>
                ) : filtered.map(s => (
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
                      <button onClick={() => setRevokeConfirm(s.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Revoke session">
                        <Ban size={13} />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-500">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)}
                      className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${i === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                      {i + 1}
                    </button>
                  )).slice(Math.max(0, page - 2), page + 3)}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {revokeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
            <h3 className="text-lg font-semibold mb-2">Revoke Session?</h3>
            <p className="text-sm text-gray-500 mb-6">This will immediately disconnect the user. This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRevokeConfirm(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={() => revoke(revokeConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors">Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
