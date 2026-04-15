import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Pencil, X, Loader2, Search } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

const roleBadge: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  user: 'bg-gray-100 text-gray-600',
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const loadUsers = () => {
    setLoading(true);
    api.get<PaginatedResponse<User>>('/api/users').then(data => {
      setUsers(data.items);
      setTotal(data.total);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const createUser = async () => {
    if (!newUser.username.trim()) {
      setError('Username is required');
      usernameRef.current?.focus();
      return;
    }
    if (!newUser.password || newUser.password.length < 6) {
      setError('Password must be at least 6 characters');
      passwordRef.current?.focus();
      return;
    }
    try {
      await api.post('/api/users', newUser);
      setShowCreate(false);
      setNewUser({ username: '', password: '', role: 'user' });
      setError('');
      showSuccess('User created successfully');
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteUser = async (user: User) => {
    try {
      await api.del(`/api/users/${user.id}`);
      setDeleteConfirm(null);
      showSuccess('User deleted');
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPassword('');
    setError('');
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      const body: Record<string, string> = { role: editRole };
      if (editPassword.trim()) {
        if (editPassword.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        body.password = editPassword;
      }
      await api.put(`/api/users/${editingUser.id}`, body);
      setEditingUser(null);
      showSuccess('User updated successfully');
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Users ({search ? `${filtered.length} of ${total}` : total})</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
          </div>
          <button onClick={() => { setShowCreate(!showCreate); setError(''); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} />
            Create User
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">{success}</div>}

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
            <input ref={usernameRef} placeholder="Username" value={newUser.username} onChange={e => { setNewUser(u => ({ ...u, username: e.target.value })); setError(''); }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input ref={passwordRef} placeholder="Min 6 characters" type="password" value={newUser.password} onChange={e => { setNewUser(u => ({ ...u, password: e.target.value })); setError(''); }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(false); setError(''); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors">Cancel</button>
            <button onClick={createUser} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors">Save</button>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input value={editingUser.username} disabled className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave empty to keep current"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Min 6 characters. Leave blank to keep existing password.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading users...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Username</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Created</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">{search ? 'No matching users' : 'No users found'}</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
            <h3 className="text-lg font-semibold mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete &ldquo;{deleteConfirm.username}&rdquo; and all their data. This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
