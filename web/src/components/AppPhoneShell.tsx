import type { ReactNode } from 'react';
import type { PreviewBottomBarSlot, PreviewLaunchpadModule } from '../lib/previewResolver';

interface AppPhoneShellProps {
  darkMode?: boolean;
  bottomBar: PreviewBottomBarSlot[];
  launchpadModules: PreviewLaunchpadModule[];
  /** null = launchpad grid; string = active module */
  activeModuleId: string | null;
  onSelectModule: (moduleId: string | null) => void;
  children?: ReactNode;
  className?: string;
  resolveIcon?: (moduleId: string, fallbackIcon: string) => string;
}

/**
 * Shared iPhone-style app shell for App Editor and BrowserPreview (FF4-APP-014).
 * Center content + bottom bar + launchpad — no extra sidebars inside the phone mockup.
 */
export function AppPhoneShell({
  darkMode = false,
  bottomBar,
  launchpadModules,
  activeModuleId,
  onSelectModule,
  children,
  className = '',
  resolveIcon,
}: AppPhoneShellProps) {
  const shellBg = darkMode ? 'bg-gray-900' : 'bg-white';
  const contentBg = darkMode ? 'bg-gray-900' : 'bg-white';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500';
  const labelText = darkMode ? 'text-gray-200' : 'text-gray-600';
  const activeTab = darkMode ? 'text-blue-400' : 'text-blue-600';
  const inactiveTab = darkMode ? 'text-gray-400' : 'text-gray-600';

  const getIcon = (moduleId: string, fallback: string) =>
    resolveIcon?.(moduleId, fallback) ?? fallback;

  const showLaunchpad = activeModuleId === null;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`w-[375px] h-[812px] ${shellBg} rounded-[3rem] shadow-2xl border-8 border-gray-900 overflow-hidden flex flex-col`}
        data-testid="app-phone-shell"
      >
        <div className={`h-11 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border-b ${borderColor} flex items-center justify-center shrink-0`}>
          <div className={`text-xs ${mutedText}`}>9:41</div>
        </div>

        <div className={`flex-1 overflow-y-auto ${contentBg} p-4`} data-testid="app-phone-content">
          {showLaunchpad ? (
            launchpadModules.length > 0 ? (
              <div data-testid="app-phone-launchpad">
                <h4 className={`text-[11px] font-semibold ${mutedText} uppercase tracking-wider mb-3 px-1`}>
                  Launchpad
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {launchpadModules.map((mod) => (
                    <button
                      key={mod.module_instance_id}
                      type="button"
                      onClick={() => onSelectModule(mod.module_instance_id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors ${
                        darkMode ? 'hover:bg-gray-800 active:bg-gray-700' : 'hover:bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      <span className="text-3xl">
                        {getIcon(mod.module_instance_id, mod.icon)}
                      </span>
                      <span className={`text-[10px] ${labelText} text-center leading-tight line-clamp-2`}>
                        {mod.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center h-full text-center ${mutedText}`}>
                <p className="text-xs">No launchpad modules</p>
                <p className="text-[10px] mt-1 opacity-70">Select a tab below</p>
              </div>
            )
          ) : (
            children ?? (
              <div className={`flex items-center justify-center h-full text-sm ${mutedText} px-6 text-center`}>
                Module content unavailable
              </div>
            )
          )}
        </div>

        <div className={`h-[88px] ${shellBg} border-t ${borderColor} px-4 pb-6 pt-2 shrink-0`} data-testid="app-phone-bottom-bar">
          <div className="flex items-center justify-around h-full">
            {bottomBar.length === 0 ? (
              <div className={`text-xs ${mutedText}`}>No modules in bottom bar</div>
            ) : (
              bottomBar.map((slot) => {
                const isActive = activeModuleId === slot.module_instance_id;
                return (
                  <button
                    key={slot.module_instance_id}
                    type="button"
                    onClick={() => onSelectModule(slot.module_instance_id)}
                    className={`flex flex-col items-center gap-1 min-w-0 transition-colors ${
                      isActive ? activeTab : inactiveTab
                    }`}
                  >
                    <span className="text-2xl">
                      {getIcon(slot.module_instance_id, slot.icon)}
                    </span>
                    <span className={`text-[10px] truncate max-w-[60px] ${isActive ? activeTab : labelText}`}>
                      {slot.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
