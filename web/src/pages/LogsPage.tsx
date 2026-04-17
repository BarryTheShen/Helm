import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Ban, ChevronLeft, ChevronRight, Filter, Loader2, Search } from 'lucide-react';

interface Session {
  id: string;
  user_id: string;
  username: string | null;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
}

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

const PAGE_SIZE = 25;

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

export function LogsPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'audit'>('sessions');

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsSuccess, setSessionsSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Audit state
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadSessions = (pageNum = sessionsPage) => {
    setSessionsLoading(true);
    api.get<PaginatedResponse<Session>>(`/api/sessions?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`).then(d => {
      setSessions(d.items);
      setSessionsTotal(d.total);
    }).catch(e => setSessionsError(e.message)).finally(() => setSessionsLoading(false));
  };

  const loadAudit = (pageNum = auditPage) => {
    setAuditLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(pageNum * PAGE_SIZE));
    if (filter) params.set('resource_type', filter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    api.get<PaginatedResponse<AuditEntry>>(`/api/audit?${params.toString()}`).then(d => {
      setEntries(d.items);
      setAuditTotal(d.total);
    }).finally(() => setAuditLoading(false));
  };

  useEffect(() => { if (activeTab === 'sessions') loadSessions(); }, [sessionsPage]);
  useEffect(() => { if (activeTab === 'audit') { setAuditPage(0); loadAudit(0); } }, [filter, dateFrom, dateTo]);
  useEffect(() => { if (activeTab === 'audit') loadAudit(); }, [auditPage]);

  useEffect(() => {
    if (activeTab === 'sessions') loadSessions();
    else loadAudit();
  }, [activeTab]);

  const revoke = async (id: string) => {
    try {
      await api.del(`/api/sessions/${id}`);
      setSessionsSuccess('Session revoked successfully');
      setRevokeConfirm(null);
      setTimeout(() => setSessionsSuccess(''), 3000);
      loadSessions();
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to revoke session');
    }
  };

  const sessionsTotalPages = Math.ceil(sessionsTotal / PAGE_SIZE);
  const auditTotalPages = Math.ceil(auditTotal / PAGE_SIZE);
  const filteredSessions = search
    ? sessions.filter(s => (s.username || '').toLowerCase().includes(search.toLowerCase()) || (s.device_name || '').toLowerCase().includes(search.toLowerCase()))
    : sessions;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Logs</h2>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'sessions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sessions ({sessionsTotal})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Log ({auditTotal})
          </button>
        </nav>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <>
          <div className="flex items-center justify-end mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search users or devices..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
            </div>
          </div>

          {sessionsError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{sessionsError}</div>}
          {sessionsSuccess && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">{sessionsSuccess}</div>}

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {sessionsLoading ? (
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
                    {filteredSessions.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No sessions found</td></tr>
                    ) : filteredSessions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{s.username || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.device_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setRevokeConfirm(s.id)} className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors inline-flex items-center gap-1">
                            <Ban size={14} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessionsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-500">Showing {sessionsPage * PAGE_SIZE + 1}–{Math.min((sessionsPage + 1) * PAGE_SIZE, sessionsTotal)} of {sessionsTotal}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSessionsPage(p => Math.max(0, p - 1))} disabled={sessionsPage === 0}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: sessionsTotalPages }, (_, i) => (
                        <button key={i} onClick={() => setSessionsPage(i)}
                          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${i === sessionsPage ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                          {i + 1}
                        </button>
                      )).slice(Math.max(0, sessionsPage - 2), sessionsPage + 3)}
                      <button onClick={() => setSessionsPage(p => Math.min(sessionsTotalPages - 1, p + 1))} disabled={sessionsPage >= sessionsTotalPages - 1}
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
        </>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <>
          <div className="flex items-center justify-end gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter size={14} />
              <label className="text-xs font-medium text-gray-500">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <label className="text-xs font-medium text-gray-500">To</label>
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

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {auditLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                Loading audit entries...
              </div>
            ) : (
              <>
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
                    {entries.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No audit entries found</td></tr>
                    ) : entries.map(e => (
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
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-500">Showing {auditPage * PAGE_SIZE + 1}–{Math.min((auditPage + 1) * PAGE_SIZE, auditTotal)} of {auditTotal}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: auditTotalPages }, (_, i) => (
                        <button key={i} onClick={() => setAuditPage(i)}
                          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${i === auditPage ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                          {i + 1}
                        </button>
                      )).slice(Math.max(0, auditPage - 2), auditPage + 3)}
                      <button onClick={() => setAuditPage(p => Math.min(auditTotalPages - 1, p + 1))} disabled={auditPage >= auditTotalPages - 1}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
