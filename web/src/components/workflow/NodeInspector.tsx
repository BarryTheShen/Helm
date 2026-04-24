import { X, Trash2 } from 'lucide-react';
import type { Node } from 'reactflow';
import { useState, useEffect } from 'react';

interface NodeInspectorProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, data: any) => void;
  onDelete: () => void;
}

// Action registry - all available actions
const ACTIONS = [
  // Server actions
  { value: 'refresh_data', label: 'Refresh Data', category: 'Data' },
  { value: 'submit_form', label: 'Submit Form', category: 'Data' },
  { value: 'send_to_agent', label: 'Send to Agent', category: 'AI' },
  { value: 'mark_notification_read', label: 'Mark Notification Read', category: 'Notifications' },
  { value: 'create_calendar_event', label: 'Create Calendar Event', category: 'Calendar' },
  { value: 'delete_calendar_event', label: 'Delete Calendar Event', category: 'Calendar' },
  { value: 'approve_draft', label: 'Approve Draft', category: 'SDUI' },
  { value: 'reject_draft', label: 'Reject Draft', category: 'SDUI' },
  { value: 'set_variable', label: 'Set Variable', category: 'Variables' },
  { value: 'fetch_rss', label: 'Fetch RSS Feed', category: 'Data' },
  { value: 'fetch_weather', label: 'Fetch Weather', category: 'Data' },
  { value: 'run_workflow', label: 'Run Workflow', category: 'Workflows' },

  // Client actions
  { value: 'navigate', label: 'Navigate', category: 'Navigation' },
  { value: 'go_back', label: 'Go Back', category: 'Navigation' },
  { value: 'open_url', label: 'Open URL', category: 'Navigation' },
  { value: 'set_component_state', label: 'Set Component State', category: 'UI' },
  { value: 'toggle', label: 'Toggle', category: 'UI' },
  { value: 'show_notification', label: 'Show Notification', category: 'Notifications' },
  { value: 'show_alert', label: 'Show Alert', category: 'Notifications' },
  { value: 'haptic', label: 'Haptic Feedback', category: 'UI' },
  { value: 'share', label: 'Share', category: 'System' },
  { value: 'copy_text', label: 'Copy Text', category: 'System' },
  { value: 'delay', label: 'Delay', category: 'Flow' },
  { value: 'chain', label: 'Chain Actions', category: 'Flow' },
  { value: 'conditional', label: 'Conditional', category: 'Flow' },
];

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'onSchedule', label: 'On Schedule' },
  { value: 'onDataChange', label: 'On Data Change' },
  { value: 'onServerEvent', label: 'On Server Event' },
];

export function NodeInspector({ node, onClose, onUpdate, onDelete }: NodeInspectorProps) {
  // Local state to prevent input resets
  const [localData, setLocalData] = useState(node.data);

  // Sync local state when node changes (but not on every render)
  useEffect(() => {
    setLocalData(node.data);
  }, [node.id]); // Only reset when switching to a different node

  const updateData = (updates: any) => {
    setLocalData((prev) => {
      const newData = { ...prev, ...updates };
      // Defer parent update to avoid re-render during typing
      setTimeout(() => onUpdate(node.id, newData), 0);
      return newData;
    });
  };

  const updateParams = (key: string, value: any) => {
    setLocalData((prev) => {
      const params = prev.params || {};
      const newData = { ...prev, params: { ...params, [key]: value } };
      setTimeout(() => onUpdate(node.id, newData), 0);
      return newData;
    });
  };

  const updateConfig = (key: string, value: any) => {
    setLocalData((prev) => {
      const config = prev.config || {};
      const newData = { ...prev, config: { ...config, [key]: value } };
      setTimeout(() => onUpdate(node.id, newData), 0);
      return newData;
    });
  };

  const renderTriggerForm = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
        <select
          value={localData.triggerType || 'manual'}
          onChange={(e) => updateData({ triggerType: e.target.value })}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {localData.triggerType === 'onSchedule' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
          <input
            type="text"
            value={localData.config?.cron || ''}
            onChange={(e) => updateConfig('cron', e.target.value)}
            placeholder="0 9 * * *"
            className="w-full px-3 py-2 border rounded-md text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">Example: 0 9 * * * (daily at 9am)</p>
        </div>
      )}

      {localData.triggerType === 'onDataChange' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
          <input
            type="text"
            value={localData.config?.dataSource || ''}
            onChange={(e) => updateConfig('dataSource', e.target.value)}
            placeholder="module_id or data_source_id"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      )}

      {localData.triggerType === 'onServerEvent' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
          <input
            type="text"
            value={localData.config?.eventType || ''}
            onChange={(e) => updateConfig('eventType', e.target.value)}
            placeholder="form_submitted, notification_received, etc."
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      )}
    </>
  );

  const renderActionForm = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
        <select
          value={localData.action || ''}
          onChange={(e) => updateData({ action: e.target.value })}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Select action...</option>
          {Object.entries(
            ACTIONS.reduce((acc, action) => {
              if (!acc[action.category]) acc[action.category] = [];
              acc[action.category].push(action);
              return acc;
            }, {} as Record<string, typeof ACTIONS>)
          ).map(([category, actions]) => (
            <optgroup key={category} label={category}>
              {actions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Parameters (JSON)
        </label>
        <textarea
          value={JSON.stringify(localData.params || {}, null, 2)}
          onChange={(e) => {
            try {
              const params = JSON.parse(e.target.value);
              updateData({ params });
            } catch {
              // Invalid JSON, update local state anyway to allow typing
              setLocalData({ ...localData, params: e.target.value });
            }
          }}
          className="w-full px-3 py-2 border rounded-md text-sm font-mono h-40"
          placeholder='{\n  "key": "value"\n}'
        />
        <p className="text-xs text-gray-500 mt-1">
          Use mustache syntax for variables: {`{{step_1.output.result}}`}
        </p>
      </div>
    </>
  );

  const renderConditionForm = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
      <input
        type="text"
        value={localData.condition || ''}
        onChange={(e) => updateData({ condition: e.target.value })}
        placeholder="step_1.output.temperature > 20"
        className="w-full px-3 py-2 border rounded-md text-sm font-mono"
      />
      <p className="text-xs text-gray-500 mt-1">
        Reference previous step outputs: step_N.output.field
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Outputs: <span className="font-semibold">true</span> (left/green handle) or <span className="font-semibold">false</span> (right/red handle)
      </p>
    </div>
  );

  const renderSwitchForm = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Switch Value</label>
        <input
          type="text"
          value={localData.value || ''}
          onChange={(e) => updateData({ value: e.target.value })}
          placeholder="step_1.output.status"
          className="w-full px-3 py-2 border rounded-md text-sm font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          Variable reference to switch on
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cases (comma-separated)</label>
        <input
          type="text"
          value={(localData.cases || []).join(', ')}
          onChange={(e) => updateData({ cases: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })}
          placeholder="success, error, pending"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Create edges with matching labels for each case
        </p>
      </div>
    </>
  );

  const renderLoopForm = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Items (array reference)</label>
        <input
          type="text"
          value={localData.items || ''}
          onChange={(e) => updateData({ items: e.target.value })}
          placeholder="step_1.output.articles"
          className="w-full px-3 py-2 border rounded-md text-sm font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          Reference to an array from previous step
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Or Fixed Iterations</label>
        <input
          type="number"
          value={localData.iterations || 1}
          onChange={(e) => updateData({ iterations: parseInt(e.target.value) || 1 })}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Used if items is not provided
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Loop Variable Name</label>
        <input
          type="text"
          value={localData.variable || 'item'}
          onChange={(e) => updateData({ variable: e.target.value })}
          placeholder="item"
          className="w-full px-3 py-2 border rounded-md text-sm font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          Access current item as {`{{${localData.variable || 'item'}}}`}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
        <p className="font-semibold mb-1">Loop Handles:</p>
        <p><span className="font-mono bg-white px-1 rounded">body</span> (left/green): Loop body - executes for each iteration</p>
        <p className="mt-1"><span className="font-mono bg-white px-1 rounded">next</span> (right/blue): After loop completes</p>
      </div>
    </>
  );

  return (
    <div className="w-80 bg-white border-l overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
        <h2 className="font-semibold text-gray-900">Node Inspector</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={localData.label || ''}
            onChange={(e) => updateData({ label: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Node label"
          />
        </div>

        <div className="border-t pt-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">
            {node.type} Configuration
          </div>

          {node.type === 'trigger' && renderTriggerForm()}
          {node.type === 'action' && renderActionForm()}
          {node.type === 'condition' && renderConditionForm()}
          {node.type === 'switch' && renderSwitchForm()}
          {node.type === 'loop' && renderLoopForm()}
        </div>

        <div className="border-t pt-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-2">Node Output</div>
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono">
            {`{{step_${node.id}.output}}`}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Reference this node's output in downstream nodes
          </p>
        </div>

        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </button>
      </div>
    </div>
  );
}
