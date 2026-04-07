import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Component {
  id: string;
  type: string;
  tier: string;
  name: string;
  icon: string;
  description: string;
  is_active: boolean;
}

const tierMeta: Record<string, { label: string; color: string; border: string }> = {
  atomic: { label: 'Atomic Components', color: 'text-blue-700', border: 'border-blue-200' },
  structural: { label: 'Structural Components', color: 'text-green-700', border: 'border-green-200' },
  composite: { label: 'Composite Components', color: 'text-purple-700', border: 'border-purple-200' },
  hardcoded: { label: 'Hardcoded Components', color: 'text-gray-700', border: 'border-gray-200' },
};

export function ComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);

  useEffect(() => {
    api.get<Component[]>('/api/components/registry').then(setComponents);
  }, []);

  const tiers = [...new Set(components.map(c => c.tier))];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Component Registry</h2>
      {tiers.map(tier => {
        const meta = tierMeta[tier] || { label: `${tier} Components`, color: 'text-gray-700', border: 'border-gray-200' };
        const comps = components.filter(c => c.tier === tier);
        return (
          <div key={tier} className="mb-8">
            <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${meta.border}`}>
              <h3 className={`text-base font-semibold ${meta.color}`}>{meta.label}</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{comps.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {comps.map(c => (
                <div key={c.id} className="bg-white flex items-center gap-3 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-2xl shrink-0">{c.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-gray-500 text-xs truncate">{c.description}</div>
                  </div>
                  {!c.is_active && (
                    <span className="ml-auto shrink-0 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
