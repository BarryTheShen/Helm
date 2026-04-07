import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Users, Key, Plug, CalendarDays, Workflow, Bell, Smartphone, FileText, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Stats {
  total_users: number;
  active_sessions: number;
  connected_ws_clients: number;
  total_events: number;
  total_workflows: number;
  active_workflows: number;
  total_notifications: number;
  unread_notifications: number;
  total_screens: number;
  total_templates: number;
  total_audit_entries: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Stats>('/api/admin/stats').then(setStats).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!stats) return <div className="p-6 text-gray-500">Loading...</div>;

  const cards: { label: string; value: string | number; icon: LucideIcon; color: string }[] = [
    { label: 'Users', value: stats.total_users, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Sessions', value: stats.active_sessions, icon: Key, color: 'text-green-600 bg-green-50' },
    { label: 'WS Connections', value: stats.connected_ws_clients, icon: Plug, color: 'text-purple-600 bg-purple-50' },
    { label: 'Calendar Events', value: stats.total_events, icon: CalendarDays, color: 'text-orange-600 bg-orange-50' },
    { label: 'Workflows', value: `${stats.active_workflows}/${stats.total_workflows}`, icon: Workflow, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Notifications', value: `${stats.unread_notifications} unread`, icon: Bell, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Screens', value: stats.total_screens, icon: Smartphone, color: 'text-pink-600 bg-pink-50' },
    { label: 'Templates', value: stats.total_templates, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Audit Entries', value: stats.total_audit_entries, icon: ClipboardList, color: 'text-gray-600 bg-gray-100' },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className={`inline-flex p-2.5 rounded-lg ${c.color}`}>
              <c.icon size={22} />
            </div>
            <div className="text-2xl font-bold mt-3">{c.value}</div>
            <div className="text-gray-500 text-sm mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
