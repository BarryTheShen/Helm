import { useAuthStore } from '../stores/authStore';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Username</label>
            <div className="text-base font-medium">{user?.username}</div>
          </div>
          <div>
            <label className="text-sm text-gray-600">Role</label>
            <div className="text-base font-medium capitalize">{user?.role}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">General Settings</h2>
        <p className="text-sm text-gray-600">
          Additional settings will be available in future updates.
        </p>
      </div>
    </div>
  );
}
