import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Loader2, Search } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<Component[]>('/api/components/registry')
      .then(setComponents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? components.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()) || c.type.toLowerCase().includes(search.toLowerCase()))
    : components;
  const tiers = [...new Set(filtered.map(c => c.tier))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Component Registry ({components.length})</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search components..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        </div>
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading components...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{search ? 'No components match your search.' : 'No components found in the registry.'}</p>
      ) : (
        <>
      {tiers.map(tier => {
        const meta = tierMeta[tier] || { label: `${tier} Components`, color: 'text-gray-700', border: 'border-gray-200' };
        const comps = filtered.filter(c => c.tier === tier);
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
        </>
      )}
    </div>
  );
}
