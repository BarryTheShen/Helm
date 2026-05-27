/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, X, Loader2, CheckCircle, AlertCircle, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

// ── Data types ──────────────────────────────────────────────────────────────

interface DeviceInfo {
  id: string;
  device_name: string;
  device_id: string;
  config_json: Record<string, any>;
  last_seen: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface PreviewSessionInfo {
  id: string;
  target_type: string;
  app_id: string | null;
  module_id: string | null;
  device_id: string | null;
  resolved_config_json: Record<string, any> | null;
  resolved_sdui_json: Record<string, any> | null;
  status: string;
  created_at: string;
  expires_at: string;
  exited_at: string | null;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface PreviewPickerProps {
  appId: string;
  onSelectBrowser: () => void;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDevicePlatform(device: DeviceInfo): string | null {
  return device.config_json?.platform ?? null;
}

// ── Component ───────────────────────────────────────────────────────────────

export function PreviewPicker({ appId, onSelectBrowser, onClose }: PreviewPickerProps) {
  // Step: 'choose' | 'devices' | 'starting' | 'active' | 'error'
  const [step, setStep] = useState<'choose' | 'devices' | 'starting' | 'active' | 'error'>('choose');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [session, setSession] = useState<PreviewSessionInfo | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [exiting, setExiting] = useState(false);

  // ── Hover state for the choose step (kept from original) ────────────
  const [hoveredOption, setHoveredOption] = useState<'browser' | 'device' | null>(null);

  // ── Fetch devices when entering device selection step ───────────────
  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    setDevicesError(null);
    try {
      const data = await api.get<DeviceInfo[]>('/api/devices');
      setDevices(Array.isArray(data) ? data : []);
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'devices' && devices.length === 0 && !loadingDevices && !devicesError) {
      void loadDevices();
    }
  }, [step, devices.length, loadingDevices, devicesError, loadDevices]);

  // ── Start device preview ────────────────────────────────────────────
  const startDevicePreview = async (deviceId: string, deviceName: string) => {
    setStep('starting');
    setPreviewError(null);
    setSelectedDeviceName(deviceName);
    try {
      const result = await api.post<PreviewSessionInfo>(
        `/api/apps/${appId}/preview/device`,
        { device_id: deviceId }
      );
      setSession(result);
      setStep('active');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to start device preview');
      setStep('error');
    }
  };

  // ── Extend preview session ──────────────────────────────────────────
  const extendSession = async () => {
    if (!session) return;
    setExtending(true);
    try {
      const result = await api.post<PreviewSessionInfo>(
        `/api/modules/preview-sessions/${session.id}/extend`,
        { additional_minutes: 30 }
      );
      setSession(result);
    } catch (err) {
      console.error('Failed to extend preview session:', err);
    } finally {
      setExtending(false);
    }
  };

  // ── Exit preview session ────────────────────────────────────────────
  const exitSession = async () => {
    if (!session) return;
    setExiting(true);
    try {
      await api.post(`/api/modules/preview-sessions/${session.id}/exit`, {});
    } catch (err) {
      console.error('Failed to exit preview session:', err);
    } finally {
      onClose();
    }
  };

  // ── Render: Choose step ─────────────────────────────────────────────
  if (step === 'choose') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preview App</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose how you want to preview your app
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Options */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Browser Preview Option */}
              <button
                data-testid="preview-web-admin"
                onClick={onSelectBrowser}
                onMouseEnter={() => setHoveredOption('browser')}
                onMouseLeave={() => setHoveredOption(null)}
                className={`relative p-6 border-2 rounded-xl transition-all ${
                  hoveredOption === 'browser'
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div
                    className={`p-4 rounded-full transition-colors ${
                      hoveredOption === 'browser'
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Monitor
                      size={32}
                      className={hoveredOption === 'browser' ? 'text-blue-600' : 'text-gray-600'}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      Preview in Web Admin
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Quick preview in your browser. Instant feedback with component rendering and navigation.
                    </p>
                  </div>
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-600">✓</span>
                      <span>Instant preview</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-600">✓</span>
                      <span>Component rendering</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-yellow-600">⚠</span>
                      <span>Read-only actions</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Device Preview Option */}
              <button
                data-testid="preview-on-device"
                onClick={() => setStep('devices')}
                onMouseEnter={() => setHoveredOption('device')}
                onMouseLeave={() => setHoveredOption(null)}
                className={`relative p-6 border-2 rounded-xl transition-all ${
                  hoveredOption === 'device'
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div
                    className={`p-4 rounded-full transition-colors ${
                      hoveredOption === 'device'
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Smartphone
                      size={32}
                      className={hoveredOption === 'device' ? 'text-blue-600' : 'text-gray-600'}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      Preview on Device...
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Push preview to a connected device. Full interactivity with real native components.
                    </p>
                  </div>
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-600">✓</span>
                      <span>Full interactivity</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-600">✓</span>
                      <span>Native components</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-600">✓</span>
                      <span>Real device testing</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <p className="text-xs text-gray-500 text-center">
              Preview mode is ephemeral and won't affect your assigned app configuration
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Device selection step ───────────────────────────────────
  if (step === 'devices') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('choose')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back"
              >
                <ArrowLeft size={18} className="text-gray-500" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Select Device</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Choose a connected device to preview on
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Device list */}
          <div className="p-4 max-h-80 overflow-y-auto">
            {loadingDevices ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 size={28} className="animate-spin mb-3" />
                <span className="text-sm">Loading devices...</span>
              </div>
            ) : devicesError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                <AlertCircle size={28} className="text-red-400 mb-3" />
                <p className="text-sm text-red-600 mb-2">Failed to load devices</p>
                <p className="text-xs text-gray-500 mb-4">{devicesError}</p>
                <button
                  onClick={() => void loadDevices()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                <Smartphone size={36} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">No devices connected</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Make sure your mobile device has the Helm app installed and is connected to the same account.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map(device => {
                  const platform = getDevicePlatform(device);
                  const isRecent = device.last_seen
                    ? Date.now() - new Date(device.last_seen).getTime() < 300000 // 5 min
                    : false;

                  return (
                    <button
                      key={device.id}
                      onClick={() => void startDevicePreview(device.id, device.device_name)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left"
                    >
                      <div className={`p-2.5 rounded-full shrink-0 ${
                        isRecent ? 'bg-green-50' : 'bg-gray-100'
                      }`}>
                        <Smartphone size={20} className={
                          isRecent ? 'text-green-600' : 'text-gray-500'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {device.device_name}
                          </span>
                          {isRecent && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" title="Connected recently" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          {platform && (
                            <>
                              <span className="capitalize">{platform}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>Last seen {formatRelativeTime(device.last_seen)}</span>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-gray-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <p className="text-xs text-gray-500 text-center">
              Selecting a device will send the current app draft to it for preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Starting step ───────────────────────────────────────────
  if (step === 'starting') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-10">
          <div className="flex flex-col items-center text-center">
            <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Starting Device Preview</h2>
            <p className="text-sm text-gray-500">
              Pushing preview to {selectedDeviceName || 'device'}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Active preview step ─────────────────────────────────────
  if (step === 'active' && session) {
    const isExpired = new Date(session.expires_at).getTime() <= Date.now();

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Device Preview Active</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Session info */}
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800 mb-1">
                <CheckCircle size={16} />
                Preview pushed to {selectedDeviceName || 'device'}
              </div>
              <p className="text-xs text-green-700">
                The device will load the preview automatically. Check your device to see the changes.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Device</span>
                <span className="text-gray-900 font-medium">{selectedDeviceName || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Session</span>
                <span className="text-gray-900 font-mono text-xs">{session.id.slice(0, 8)}…</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Started</span>
                <span className="text-gray-900">{formatTime(session.created_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Expires</span>
                <span className={`flex items-center gap-1 font-medium ${
                  isExpired ? 'text-red-600' : 'text-amber-600'
                }`}>
                  <Clock size={14} />
                  {isExpired ? 'Expired' : formatExpiry(session.expires_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  session.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {session.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {session.status}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center gap-3">
            <button
              onClick={() => void extendSession()}
              disabled={extending || exiting || isExpired}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {extending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Extending...
                </span>
              ) : (
                'Extend 30 min'
              )}
            </button>
            <button
              onClick={() => void exitSession()}
              disabled={exiting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exiting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Exiting...
                </span>
              ) : (
                'Exit Preview'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Error step ──────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">Preview Failed</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Error body */}
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">{previewError || 'An unexpected error occurred'}</p>
            </div>
            <p className="text-xs text-gray-500">
              Make sure the device is registered and connected. You can also try the browser preview instead.
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center gap-3">
            <button
              onClick={() => {
                setPreviewError(null);
                setStep('devices');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onSelectBrowser}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Use Browser Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback — should not reach here
  return null;
}
