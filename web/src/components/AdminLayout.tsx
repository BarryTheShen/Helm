import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Users, Workflow, FileText, Paintbrush, Braces, Plug, ScrollText, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/editor', label: 'Visual Editor', icon: Paintbrush },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/variables', label: 'Variables', icon: Braces },
  { to: '/connections', label: 'Connections', icon: Plug },
];

export function AdminLayout() {
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">⛵ Helm Admin</h1>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${isActive ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'}`
            }>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            {advancedOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Advanced
          </button>

          {advancedOpen && (
            <NavLink to="/logs" className={({ isActive }) =>
              `flex items-center gap-3 pl-12 pr-5 py-2.5 text-sm transition-colors ${isActive ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'}`
            }>
              <ScrollText size={18} />
              Logs
            </NavLink>
          )}

          <NavLink to="/settings" className={({ isActive }) =>
            `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors mt-4 ${isActive ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'}`
          }>
            <Users size={18} />
            Settings
          </NavLink>
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">{user?.username || 'admin'} ({user?.role})</div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors">
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
