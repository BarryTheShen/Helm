import { useState } from 'react';
import { getAuthorableComponents } from './types';
import type { ComponentDefinition } from './types';
import { useEditorStore } from './useEditorStore';
import { Search } from 'lucide-react';

interface ComponentPaletteProps {
  onAddComponent?: (componentType: string) => void;
}

/**
 * Left-panel component palette showing all authorable components
 * organized by category. Users can click a component to add it to
 * the currently selected cell, or hover for details.
 */
export function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  const [search, setSearch] = useState('');
  const selection = useEditorStore(s => s.selection);
  const setComponent = useEditorStore(s => s.setComponent);

  const authorableComponents = getAuthorableComponents();

  const filtered = search.trim()
    ? authorableComponents.filter(c =>
        c.displayName.toLowerCase().includes(search.toLowerCase()) ||
        c.type.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
      )
    : authorableComponents;

  const sections = [
    {
      title: 'Atomic',
      components: filtered.filter(c => c.category === 'atomic'),
    },
    {
      title: 'Structural',
      components: filtered.filter(c => c.category === 'structural'),
    },
    {
      title: 'Components',
      components: filtered.filter(c => c.category === 'composite'),
    },
  ].filter(s => s.components.length > 0);

  const handleAddComponent = (type: string) => {
    // If a cell is selected, add the component there
    if (selection?.type === 'cell' && selection.rowId && selection.cellIndex !== undefined) {
      setComponent(selection.rowId, selection.cellIndex, type);
    } else if (onAddComponent) {
      onAddComponent(type);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-gray-400">
          <Search size={12} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">
            {search.trim() ? 'No matching components' : 'No components available'}
          </div>
        )}

        {sections.map((section, si) => (
          <div key={section.title}>
            {si > 0 && <div className="my-1 border-t border-gray-100" />}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1.5">
              {section.title}
              <span className="ml-1 font-normal normal-case text-gray-300">
                ({section.components.length})
              </span>
            </div>
            <div className="space-y-0.5">
              {section.components.map(comp => (
                <ComponentCard
                  key={comp.type}
                  component={comp}
                  onAdd={handleAddComponent}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selection hint */}
      {selection?.type !== 'cell' && (
        <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[10px] text-gray-400 italic">
            Select an empty cell in the canvas first, then click a component to add it.
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentCard({ component, onAdd }: { component: ComponentDefinition; onAdd: (type: string) => void }) {
  const [showTip, setShowTip] = useState(false);

  return (
    <button
      onClick={() => onAdd(component.type)}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors text-left relative group"
    >
      <span className="text-sm shrink-0">{component.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{component.displayName}</div>
        <div className="text-[10px] text-gray-400 truncate">{component.description}</div>
      </div>

      {/* Tooltip with type info */}
      {showTip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
          {component.type}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </button>
  );
}
