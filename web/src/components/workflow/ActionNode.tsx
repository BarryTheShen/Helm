import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';

interface ActionNodeProps {
  data: {
    label?: string;
    action?: string;
    params?: Record<string, any>;
  };
  selected?: boolean;
}

export function ActionNode({ data, selected }: ActionNodeProps) {
  return (
    <div
      className={`px-4 py-3 bg-blue-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <div className="flex items-center gap-2 mb-1">
        <Play className="w-4 h-4 text-blue-600" />
        <div className="font-semibold text-sm text-blue-900">
          {data.label || 'Action'}
        </div>
      </div>
      {data.action && (
        <div className="text-xs text-blue-600 font-mono">{data.action}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  );
}
