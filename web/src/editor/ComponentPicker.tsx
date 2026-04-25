import { useRef, useEffect } from 'react';
import { getAuthorableComponents } from './types';
import type { ComponentDefinition } from './types';

interface ComponentPickerProps {
  onSelect: (componentType: string, props?: Record<string, unknown>) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

function CategoryGroup({ title, components, onSelect }: {
  title: string;
  components: ComponentDefinition[];
  onSelect: (type: string, props?: Record<string, unknown>) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">{title}</div>
      <div className="space-y-0.5">
        {components.map(comp => (
          <button
            key={comp.type}
            onClick={() => onSelect(comp.type)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
          >
            <span className="text-sm">{comp.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{comp.displayName}</div>
              <div className="text-[10px] text-gray-400 truncate">{comp.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ComponentPicker({ onSelect, onClose, position }: ComponentPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const authorableComponents = getAuthorableComponents();
  const sections = [
    {
      title: 'Atomic Components',
      components: authorableComponents.filter((component) => component.category === 'atomic'),
    },
    {
      title: 'Structural',
      components: authorableComponents.filter((component) => component.category === 'structural'),
    },
    {
      title: 'Components',
      components: authorableComponents.filter((component) => component.category === 'composite'),
    },
  ].filter((section) => section.components.length > 0);

  const style = position ? {
    position: 'fixed' as const,
    left: position.x,
    top: position.y,
  } : {};

  const handleSelect = (type: string, props?: Record<string, unknown>) => {
    onSelect(type, props);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 w-64 max-h-96 overflow-y-auto"
      style={style}
    >
      <div className="px-2 py-1 border-b border-gray-100 mb-1">
        <span className="text-xs font-semibold text-gray-600">Add Component</span>
      </div>

      {sections.map((section, index) => (
        <div key={section.title}>
          {index > 0 && <div className="my-1 border-t border-gray-100" />}
          <CategoryGroup title={section.title} components={section.components} onSelect={handleSelect} />
        </div>
      ))}
    </div>
  );
}