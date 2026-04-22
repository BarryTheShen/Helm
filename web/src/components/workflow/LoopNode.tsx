import { Handle, Position } from 'reactflow';
import { Repeat } from 'lucide-react';

interface LoopNodeProps {
  data: {
    label?: string;
    items?: string;
    iterations?: number;
    variable?: string;
  };
  selected?: boolean;
}

export function LoopNode({ data, selected }: LoopNodeProps) {
  return (
    <div
      className={`px-4 py-3 bg-green-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-green-600 ring-2 ring-green-200' : 'border-green-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500" />
      <div className="flex items-center gap-2 mb-1">
        <Repeat className="w-4 h-4 text-green-600" />
        <div className="font-semibold text-sm text-green-900">
          {data.label || 'Loop'}
        </div>
      </div>
      {data.items && (
        <div className="text-xs text-green-600 font-mono truncate">{data.items}</div>
      )}
      {data.iterations && (
        <div className="text-xs text-green-500 mt-1">{data.iterations} iterations</div>
      )}
      <Handle type="source" position={Position.Bottom} id="body" className="!bg-green-500" />
    </div>
  );
}
