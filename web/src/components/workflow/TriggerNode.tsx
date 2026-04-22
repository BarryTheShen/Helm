import { Handle, Position } from 'reactflow';
import { Clock, Database, Zap } from 'lucide-react';

interface TriggerNodeProps {
  data: {
    label?: string;
    triggerType?: 'onSchedule' | 'onDataChange' | 'onServerEvent' | 'manual';
    config?: Record<string, any>;
  };
  selected?: boolean;
}

const triggerIcons = {
  onSchedule: Clock,
  onDataChange: Database,
  onServerEvent: Zap,
  manual: Zap,
};

export function TriggerNode({ data, selected }: TriggerNodeProps) {
  const Icon = triggerIcons[data.triggerType || 'manual'];

  return (
    <div
      className={`px-4 py-3 bg-indigo-50 border-2 rounded-lg shadow-sm min-w-[200px] ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-indigo-400'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-indigo-600" />
        <div className="font-semibold text-sm text-indigo-900">
          {data.label || 'Trigger'}
        </div>
      </div>
      {data.triggerType && (
        <div className="text-xs text-indigo-600">{data.triggerType}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </div>
  );
}
