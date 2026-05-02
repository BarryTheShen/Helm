import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Users, Workflow, FileText, Paintbrush, Braces, Plug, ScrollText, LogOut, ChevronDown, ChevronRight, Smartphone } from 'lucide-react';
import { ModulesTree } from '../editor/ModulesTree';

const navItems = [
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/variables', label: 'Variables', icon: Braces },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/logs', label: 'Logs', icon: ScrollText },
];

// Pages that require a wide viewport to be usable (admin tooling, not mobile UI)
const WIDE_VIEWPORT_PAGES = ['/editor'];
const MIN_EDITOR_WIDTH = 1024;

export function AdminLayout() {
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [editorExpanded, setEditorExpanded] = useState(true);

  // Clear module_instance_id from search params when navigating away from /editor.
  // React Router v7 preserves query params across SPA navigation, so ?module_instance_id=home
  // would stick around on /templates and cause issues when navigating back to /editor.
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = location.pathname;
    if (prev.startsWith('/editor') && !location.pathname.startsWith('/editor')) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('module_instance_id')) {
        params.delete('module_instance_id');
        navigate({ search: params.toString() || undefined }, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  const requiresWideViewport = WIDE_VIEWPORT_PAGES.some(p => location.pathname.startsWith(p));
  const isEditorActive = location.pathname.startsWith('/editor');
  const isAppEditorActive = location.pathname.startsWith('/app-editor');

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">⛵ Helm Admin</h1>
        </div>
        <nav className="flex-1 py-2">
          {/* App Editor */}
          <NavLink
            to="/app-editor"
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'
              }`
            }
          >
            <Smartphone size={18} />
            App Editor
          </NavLink>

          {/* Visual Editor with expandable tree */}
          <div>
            <button
              onClick={() => setEditorExpanded(!editorExpanded)}
              className={`w-full flex items-center justify-between px-5 py-2.5 text-sm transition-colors ${
                isEditorActive
                  ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Paintbrush size={18} />
                Visual Editor
              </div>
              {editorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {editorExpanded && (
              <div className="bg-gray-800/50">
                <ModulesTree />
              </div>
            )}
          </div>

          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${isActive ? 'text-blue-400 bg-blue-950 border-l-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'}`
            }>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

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
        {requiresWideViewport && (
          // Shown only below 1024px (lg breakpoint) — CSS-driven, always reactive to resize
          <div className="lg:hidden mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
            The Visual Editor requires a screen at least {MIN_EDITOR_WIDTH}px wide for full functionality.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
