import { Handle, Position } from 'reactflow';
import { Split } from 'lucide-react';

interface SwitchNodeProps {
  data: {
    label?: string;
    value?: string;
    cases?: string[];
  };
  selected?: boolean;
}

export function SwitchNode({ data, selected }: SwitchNodeProps) {
  const cases = data.cases || [];
  const caseCount = cases.length || 2;

  return (
    <div
      className={`px-4 py-3 bg-purple-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-purple-600 ring-2 ring-purple-200' : 'border-purple-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center gap-2 mb-1">
        <Split className="w-4 h-4 text-purple-600" />
        <div className="font-semibold text-sm text-purple-900">
          {data.label || 'Switch'}
        </div>
      </div>
      {data.value && (
        <div className="text-xs text-purple-600 font-mono truncate">{data.value}</div>
      )}
      <div className="text-xs text-purple-500 mt-1">{caseCount} cases</div>
      {cases.map((caseName, idx) => (
        <Handle
          key={caseName}
          type="source"
          position={Position.Bottom}
          id={caseName}
          className="!bg-purple-500"
          style={{ left: `${((idx + 1) * 100) / (caseCount + 1)}%` }}
        />
      ))}
    </div>
  );
}
