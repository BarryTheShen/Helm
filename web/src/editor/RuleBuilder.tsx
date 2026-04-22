import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ActionRule, ActionStep } from './types';

export interface RuleBuilderProps {
  rules: ActionRule[];
  onChange: (rules: ActionRule[]) => void;
  componentType?: string;
}

const ALL_TRIGGER_OPTIONS: Array<{ value: ActionRule['trigger']; label: string }> = [
  { value: 'onPress', label: 'On Press' },
  { value: 'onSubmit', label: 'On Submit' },
  { value: 'onSend', label: 'On Send' },
];

const COMPONENT_TRIGGER_MAP: Record<string, ActionRule['trigger'][]> = {
  Button: ['onPress'],
  TextInput: ['onSubmit'],
  InputBar: ['onSend'],
};

function getTriggerOptions(componentType?: string): Array<{ value: ActionRule['trigger']; label: string }> {
  if (!componentType) {
    return ALL_TRIGGER_OPTIONS;
  }

  const allowedTriggers = COMPONENT_TRIGGER_MAP[componentType];
  if (!allowedTriggers) {
    return ALL_TRIGGER_OPTIONS;
  }

  return ALL_TRIGGER_OPTIONS.filter(opt => allowedTriggers.includes(opt.value));
}

interface ActionCategory {
  label: string;
  actions: Array<{ type: string; label: string }>;
}

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    label: 'Navigation',
    actions: [
      { type: 'navigate', label: 'Navigate' },
      { type: 'open_url', label: 'Open URL' },
      { type: 'go_back', label: 'Go Back' },
      { type: 'dismiss', label: 'Dismiss' },
    ],
  },
  {
    label: 'Data',
    actions: [
      { type: 'send_to_agent', label: 'Send to Agent' },
      { type: 'set_variable', label: 'Set Variable' },
      { type: 'set_component_state', label: 'Set Component State' },
      { type: 'submit_form', label: 'Submit Form' },
      { type: 'refresh_data', label: 'Refresh Data' },
      { type: 'server_action', label: 'Server Action' },
    ],
  },
  {
    label: 'UI Feedback',
    actions: [
      { type: 'show_notification', label: 'Show Notification' },
      { type: 'show_alert', label: 'Show Alert' },
      { type: 'haptic', label: 'Haptic Feedback' },
      { type: 'toggle', label: 'Toggle' },
    ],
  },
  {
    label: 'Utility',
    actions: [
      { type: 'copy_text', label: 'Copy Text' },
      { type: 'share', label: 'Share' },
      { type: 'delay', label: 'Delay' },
      { type: 'conditional', label: 'Conditional' },
    ],
  },
];

const ALL_ACTIONS = ACTION_CATEGORIES.flatMap((cat) => cat.actions);

function getActionLabel(type: string): string {
  return ALL_ACTIONS.find((a) => a.type === type)?.label ?? type;
}

interface ParamFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea';
  placeholder?: string;
}

function getParamFields(actionType: string): ParamFieldDef[] {
  switch (actionType) {
    case 'navigate':
      return [{ key: 'target', label: 'Target', type: 'text', placeholder: 'Screen or module name' }];
    case 'open_url':
      return [{ key: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com' }];
    case 'send_to_agent':
      return [
        { key: 'message', label: 'Message', type: 'text', placeholder: 'Message to send to agent' },
      ];
    case 'set_variable':
      return [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Variable name' },
        { key: 'value', label: 'Value', type: 'text', placeholder: 'Variable value' },
      ];
    case 'set_component_state':
      return [
        { key: 'componentId', label: 'Component ID', type: 'text', placeholder: 'Target component ID' },
        { key: 'key', label: 'Key', type: 'text', placeholder: 'State key' },
        { key: 'value', label: 'Value', type: 'text', placeholder: 'State value' },
      ];
    case 'show_notification':
      return [
        { key: 'title', label: 'Title', type: 'text', placeholder: 'Notification title' },
        { key: 'message', label: 'Message', type: 'text', placeholder: 'Notification message' },
      ];
    case 'show_alert':
      return [
        { key: 'title', label: 'Title', type: 'text', placeholder: 'Alert title' },
        { key: 'message', label: 'Message', type: 'text', placeholder: 'Alert message' },
      ];
    case 'server_action':
      return [
        { key: 'function', label: 'Function', type: 'text', placeholder: 'e.g. submit_form' },
        { key: 'params', label: 'Parameters (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
      ];
    case 'copy_text':
      return [{ key: 'text', label: 'Text', type: 'text', placeholder: 'Text to copy' }];
    case 'delay':
      return [{ key: 'ms', label: 'Delay (ms)', type: 'number', placeholder: '500' }];
    case 'conditional':
      return [
        { key: 'condition', label: 'Condition', type: 'text', placeholder: 'e.g. {{variable}} == true' },
        { key: 'then', label: 'Then (JSON)', type: 'textarea', placeholder: '[{"type": "navigate", "params": {...}}]' },
      ];
    case 'submit_form':
      return [{ key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: '/api/submit' }];
    default:
      return [];
  }
}

function ActionStepEditor({
  step,
  index,
  onUpdate,
  onDelete,
}: {
  step: ActionStep;
  index: number;
  onUpdate: (step: ActionStep) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const paramFields = getParamFields(step.type);

  const handleTypeChange = (newType: string) => {
    onUpdate({ ...step, type: newType, params: {} });
  };

  const handleParamChange = (key: string, value: unknown) => {
    onUpdate({ ...step, params: { ...step.params, [key]: value } });
  };

  return (
    <div className="border border-gray-200 rounded-md bg-white">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span className="text-[10px] font-medium text-gray-400 w-4">{index + 1}.</span>
        <select
          value={step.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="flex-1 px-1.5 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
        >
          {ACTION_CATEGORIES.map((category) => (
            <optgroup key={category.label} label={category.label}>
              {category.actions.map((action) => (
                <option key={action.type} value={action.type}>
                  {action.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={onDelete}
          className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
          title="Delete step"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && paramFields.length > 0 && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-100 pt-1.5">
          {paramFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[10px] font-medium text-gray-400 mb-0.5">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={typeof step.params[field.key] === 'string'
                    ? step.params[field.key] as string
                    : step.params[field.key] !== undefined
                      ? JSON.stringify(step.params[field.key], null, 2)
                      : ''}
                  onChange={(e) => handleParamChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={2}
                  className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono resize-y"
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={typeof step.params[field.key] === 'number' ? step.params[field.key] as number : ''}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    handleParamChange(field.key, val ? Number(val) : undefined);
                  }}
                  placeholder={field.placeholder}
                  className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={typeof step.params[field.key] === 'string' ? step.params[field.key] as string : ''}
                  onChange={(e) => handleParamChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  index,
  onUpdate,
  onDelete,
  componentType,
}: {
  rule: ActionRule;
  index: number;
  onUpdate: (rule: ActionRule) => void;
  onDelete: () => void;
  componentType?: string;
}) {
  const triggerOptions = getTriggerOptions(componentType);

  const handleTriggerChange = (trigger: ActionRule['trigger']) => {
    onUpdate({ ...rule, trigger });
  };

  const handleAddStep = () => {
    const newStep: ActionStep = {
      id: crypto.randomUUID(),
      type: 'navigate',
      params: {},
    };
    onUpdate({ ...rule, actions: [...rule.actions, newStep] });
  };

  const handleUpdateStep = (stepIndex: number, step: ActionStep) => {
    const nextActions = rule.actions.map((s, i) => (i === stepIndex ? step : s));
    onUpdate({ ...rule, actions: nextActions });
  };

  const handleDeleteStep = (stepIndex: number) => {
    onUpdate({ ...rule, actions: rule.actions.filter((_, i) => i !== stepIndex) });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      {/* Rule header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500">Rule {index + 1}</span>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
          title="Delete rule"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-2.5 space-y-2.5">
        {/* Trigger */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-0.5">When</label>
          <select
            value={rule.trigger}
            onChange={(e) => handleTriggerChange(e.target.value as ActionRule['trigger'])}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white"
          >
            {triggerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">Then</label>
          <div className="space-y-1.5">
            {rule.actions.map((step, stepIndex) => (
              <ActionStepEditor
                key={step.id}
                step={step}
                index={stepIndex}
                onUpdate={(updated) => handleUpdateStep(stepIndex, updated)}
                onDelete={() => handleDeleteStep(stepIndex)}
              />
            ))}
          </div>
          <button
            onClick={handleAddStep}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus size={12} />
            Add Action
          </button>
        </div>
      </div>
    </div>
  );
}

export function RuleBuilder({ rules, onChange, componentType }: RuleBuilderProps) {
  const triggerOptions = getTriggerOptions(componentType);
  const defaultTrigger = triggerOptions[0]?.value ?? 'onPress';

  const handleAddRule = () => {
    const newRule: ActionRule = {
      id: crypto.randomUUID(),
      trigger: defaultTrigger,
      actions: [],
    };
    onChange([...rules, newRule]);
  };

  const handleUpdateRule = (index: number, rule: ActionRule) => {
    const next = rules.map((r, i) => (i === index ? rule : r));
    onChange(next);
  };

  const handleDeleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <div className="text-xs text-gray-400 py-2">
          No rules configured. Add a rule to define behavior for this component.
        </div>
      )}

      {rules.map((rule, index) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          index={index}
          onUpdate={(updated) => handleUpdateRule(index, updated)}
          onDelete={() => handleDeleteRule(index)}
          componentType={componentType}
        />
      ))}

      <button
        onClick={handleAddRule}
        className="w-full py-1.5 text-xs text-blue-600 hover:text-blue-800 border border-dashed border-blue-300 hover:border-blue-400 rounded-md transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={14} />
        Add Rule
      </button>
    </div>
  );
}