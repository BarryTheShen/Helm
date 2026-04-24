import { useState } from 'react';
import { Monitor, Smartphone, X } from 'lucide-react';

interface PreviewPickerProps {
  appId: string;
  onSelectBrowser: () => void;
  onSelectDevice: () => void;
  onClose: () => void;
}

export function PreviewPicker({ appId, onSelectBrowser, onSelectDevice, onClose }: PreviewPickerProps) {
  const [hoveredOption, setHoveredOption] = useState<'browser' | 'device' | null>(null);

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
                    Browser Preview
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
              onClick={onSelectDevice}
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
                    Device Preview
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
