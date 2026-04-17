import { useRef, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Variable } from '../lib/api';

export interface VariableOption {
  namespace: string;
  key: string;
  displayName: string;
  description?: string;
}

interface VariablePickerProps {
  onSelect: (variable: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
  filter?: string;
  screenComponents?: Array<{ id: string; type: string }>;
}

interface VariableCategory {
  title: string;
  namespace: string;
  variables: VariableOption[];
}

const STATIC_NAMESPACES: VariableCategory[] = [
  {
    title: 'User',
    namespace: 'user',
    variables: [
      { namespace: 'user', key: 'username', displayName: 'Username', description: 'Current user username' },
      { namespace: 'user', key: 'id', displayName: 'User ID', description: 'Current user ID' },
      { namespace: 'user', key: 'email', displayName: 'Email', description: 'Current user email' },
    ],
  },
  {
    title: 'Self',
    namespace: 'self',
    variables: [
      { namespace: 'self', key: 'value', displayName: 'Value', description: 'Current component value' },
      { namespace: 'self', key: 'state', displayName: 'State', description: 'Current component state' },
    ],
  },
];

function CategoryGroup({ title, variables, onSelect, filter }: {
  title: string;
  variables: VariableOption[];
  onSelect: (variable: string) => void;
  filter?: string;
}) {
  const filteredVars = filter
    ? variables.filter(v =>
        v.displayName.toLowerCase().includes(filter.toLowerCase()) ||
        v.key.toLowerCase().includes(filter.toLowerCase()) ||
        v.description?.toLowerCase().includes(filter.toLowerCase())
      )
    : variables;

  if (filteredVars.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">{title}</div>
      <div className="space-y-0.5">
        {filteredVars.map(v => (
          <button
            key={`${v.namespace}.${v.key}`}
            onClick={() => onSelect(`{{${v.namespace}.${v.key}}}`)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium font-mono">{v.namespace}.{v.key}</div>
              {v.description && (
                <div className="text-[10px] text-gray-400 truncate">{v.description}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function VariablePicker({ onSelect, onClose, position, filter, screenComponents }: VariablePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [customVariables, setCustomVariables] = useState<Variable[]>([]);
  const [connections, setConnections] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [varsRes, connsRes] = await Promise.all([
          api.getVariables({ limit: 100 }),
          api.get<{ items: Array<{ id: string; name: string; provider: string }> }>('/api/connections?limit=100'),
        ]);
        setCustomVariables(varsRes.items);
        setConnections(connsRes.items);
      } catch (err) {
        console.error('Failed to fetch variables/connections:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  const componentVariables: VariableOption[] = screenComponents
    ? screenComponents.map(c => ({
        namespace: 'component',
        key: `${c.id}.value`,
        displayName: `${c.id} (${c.type})`,
        description: 'Component value',
      }))
    : [];

  const categories: VariableCategory[] = [
    ...STATIC_NAMESPACES,
    ...(componentVariables.length > 0 ? [{
      title: 'Components',
      namespace: 'component',
      variables: componentVariables,
    }] : []),
    {
      title: 'Custom Variables',
      namespace: 'custom',
      variables: customVariables.map(v => ({
        namespace: 'custom',
        key: v.name,
        displayName: v.name,
        description: v.description || undefined,
      })),
    },
    {
      title: 'Environment',
      namespace: 'env',
      variables: [
        { namespace: 'env', key: 'NODE_ENV', displayName: 'NODE_ENV', description: 'Environment name' },
        { namespace: 'env', key: 'API_URL', displayName: 'API_URL', description: 'API base URL' },
      ],
    },
    {
      title: 'Data Sources',
      namespace: 'data',
      variables: [
        { namespace: 'data', key: 'source_name.field', displayName: 'source_name.field', description: 'Data source field' },
      ],
    },
    {
      title: 'Connections',
      namespace: 'connection',
      variables: connections.map(c => ({
        namespace: 'connection',
        key: `${c.name}.credential_key`,
        displayName: `${c.name} (${c.provider})`,
        description: 'Connection credential',
      })),
    },
  ];

  const style = position ? {
    position: 'fixed' as const,
    left: position.x,
    top: position.y,
  } : {};

  return (
    <div
      ref={ref}
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 w-72 max-h-96 overflow-y-auto"
      style={style}
    >
      <div className="text-xs font-semibold text-gray-600 px-2 py-1 border-b border-gray-100 mb-1">
        Insert Variable
      </div>
      {loading ? (
        <div className="px-2 py-4 text-xs text-gray-400 text-center">Loading...</div>
      ) : (
        <>
          {categories.map((category, index) => (
            <div key={category.namespace}>
              {index > 0 && <div className="my-1 border-t border-gray-100" />}
              <CategoryGroup
                title={category.title}
                variables={category.variables}
                onSelect={onSelect}
                filter={filter}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
