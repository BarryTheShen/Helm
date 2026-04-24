import { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

const COMMON_ICONS = [
  'star', 'heart', 'home', 'user', 'settings', 'search', 'bell', 'mail', 'phone',
  'calendar', 'clock', 'map-pin', 'camera', 'image', 'file', 'folder', 'trash',
  'edit', 'check', 'x', 'plus', 'minus', 'arrow-right', 'arrow-left', 'arrow-up',
  'arrow-down', 'chevron-right', 'chevron-left', 'chevron-up', 'chevron-down',
  'menu', 'more-vertical', 'more-horizontal', 'share', 'download', 'upload',
  'lock', 'unlock', 'eye', 'eye-off', 'info', 'alert-circle', 'alert-triangle',
  'help-circle', 'message-circle', 'send', 'bookmark', 'tag', 'filter', 'refresh',
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

// Convert kebab-case to PascalCase for Lucide icon lookup
function getIconComponent(iconName: string) {
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (LucideIcons as any)[pascalCase] || null;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filteredIcons = COMMON_ICONS.filter(icon =>
    icon.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SelectedIcon = value ? getIconComponent(value) : null;
  const SearchIcon = getIconComponent('search');
  const XIcon = getIconComponent('x');

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-left flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            {SelectedIcon && <SelectedIcon size={14} className="text-gray-600" />}
            <span className="truncate">{value || 'Select icon...'}</span>
          </span>
          {SearchIcon && <SearchIcon size={12} className="text-gray-400 ml-1 shrink-0" />}
        </button>
        {value && XIcon && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <XIcon size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              {SearchIcon && <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search icons..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {filteredIcons.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5">
                {filteredIcons.map((icon) => {
                  const IconComponent = getIconComponent(icon);
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        onChange(icon);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-2 py-1.5 text-xs text-left rounded hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                        value === icon ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {IconComponent && <IconComponent size={14} />}
                      <span>{icon}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-3 text-xs text-gray-400 text-center">
                No icons found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
