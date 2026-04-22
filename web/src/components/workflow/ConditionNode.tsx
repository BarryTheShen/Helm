import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

interface ConditionNodeProps {
  data: {
    label?: string;
    condition?: string;
  };
  selected?: boolean;
}

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  return (
    <div
      className={`px-4 py-3 bg-yellow-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-yellow-600 ring-2 ring-yellow-200' : 'border-yellow-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-yellow-600" />
        <div className="font-semibold text-sm text-yellow-900">
          {data.label || 'Condition'}
        </div>
      </div>
      {data.condition && (
        <div className="text-xs text-yellow-600 font-mono truncate">{data.condition}</div>
      )}
      <div className="flex justify-between mt-2">
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="!bg-green-500 !left-[25%]"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="!bg-red-500 !left-[75%]"
        />
      </div>
      <div className="flex justify-between text-[10px] mt-1 text-gray-500">
        <span className="ml-2">true</span>
        <span className="mr-2">false</span>
      </div>
    </div>
  );
}
