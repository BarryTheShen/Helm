import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Pencil, X } from 'lucide-react';

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
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [error, setError] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const loadUsers = () => {
    api.get<PaginatedResponse<User>>('/api/users').then(data => {
      setUsers(data.items);
      setTotal(data.total);
    }).catch(e => setError(e.message));
  };

  useEffect(() => { loadUsers(); }, []);

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
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.del(`/api/users/${id}`);
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/api/users/${editingUser.id}`, { role: editRole });
      setEditingUser(null);
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Users ({total})</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          Create User
        </button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
            <input ref={usernameRef} placeholder="Username" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input ref={passwordRef} placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
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
          <button onClick={createUser} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors">Save</button>
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
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
            {users.map(u => (
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
                    <button onClick={() => deleteUser(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
