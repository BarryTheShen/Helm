import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Loader2, Smartphone, AppWindow, Trash2 } from 'lucide-react';

interface App {
  id: string;
  name: string;
  icon: string | null;
}

interface Device {
  id: string;
  device_name: string;
  device_id: string;
  last_seen: string | null;
  assigned_app_id: string | null;
  app_name?: string | null;
  created_at: string;
  updated_at: string;
}

export function SettingsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Device | null>(null);

  const loadDevices = () => {
    setLoading(true);
    api.get<Device[]>('/api/devices')
      .then(d => setDevices(Array.isArray(d) ? d : d.items || []))
      .catch(e => {
        toast.error(e.message);
        setDevices([]);
      })
      .finally(() => setLoading(false));
  };

  const loadApps = () => {
    api.get<{ items: App[] }>('/api/apps?limit=100')
      .then(d => setApps(d.items || []))
      .catch(() => setApps([]));
  };

  useEffect(() => { loadDevices(); loadApps(); }, []);

  const assignApp = async (deviceId: string, appId: string | null) => {
    setSaving(deviceId);
    try {
      const body = appId ? { app_id: appId } : {};
      await api.put<Device>(`/api/devices/${deviceId}/app`, body);
      toast.success('App assignment updated');
      loadDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(null);
    }
  };

  const deleteDevice = async (device: Device) => {
    try {
      await api.del(`/api/devices/${device.id}`);
      toast.success('Device removed');
      loadDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage registered devices and their assigned apps</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Smartphone size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No devices registered</p>
          <p className="text-sm text-gray-400 mt-1">
            Devices appear here when the mobile app connects to the server
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  App Assigned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {devices.map(device => (
                <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Smartphone size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.device_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{device.device_id.slice(0, 20)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {device.assigned_app_id ? (
                        <AppWindow size={14} className="text-gray-400" />
                      ) : (
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-200 border border-gray-300" />
                      )}
                      <select
                        value={device.assigned_app_id || ''}
                        onChange={e => assignApp(device.id, e.target.value || null)}
                        disabled={saving === device.id}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">— None —</option>
                        {(apps || []).map(app => (
                          <option key={app.id} value={app.id}>{app.name}</option>
                        ))}
                      </select>
                      {saving === device.id && (
                        <Loader2 size={14} className="text-gray-400 animate-spin" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {device.last_seen
                      ? new Date(device.last_seen).toLocaleString()
                      : <span className="text-gray-400">Never</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setConfirmDelete(device)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove device"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-lg font-semibold mb-2">Remove Device?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Remove &ldquo;{confirmDelete.device_name}&rdquo;? This will disconnect the device from your account.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDevice(confirmDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}