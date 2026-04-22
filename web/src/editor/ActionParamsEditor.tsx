import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ActionParamsEditorProps {
  value: Record<string, unknown> | undefined;
  onChange: (value: Record<string, unknown> | undefined) => void;
  availableParams?: string[];
}

export function ActionParamsEditor({ value, onChange, availableParams = [] }: ActionParamsEditorProps) {
  const [showParamPicker, setShowParamPicker] = useState(false);
  const params = value || {};
  const paramEntries = Object.entries(params);

  const handleAddParam = (paramName: string) => {
    onChange({ ...params, [paramName]: '' });
    setShowParamPicker(false);
  };

  const handleUpdateParam = (key: string, newValue: string) => {
    onChange({ ...params, [key]: newValue });
  };

  const handleRemoveParam = (key: string) => {
    const newParams = { ...params };
    delete newParams[key];
    onChange(Object.keys(newParams).length > 0 ? newParams : undefined);
  };

  const unusedParams = availableParams.filter(p => !(p in params));

  return (
    <div className="space-y-2">
      {paramEntries.map(([key, val]) => (
        <div key={key} className="flex gap-1.5 items-start">
          <div className="flex-1 space-y-1">
            <div className="text-[10px] font-medium text-gray-500">{key}</div>
            <input
              type="text"
              value={typeof val === 'string' ? val : JSON.stringify(val)}
              onChange={(e) => handleUpdateParam(key, e.target.value)}
              placeholder="Value"
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleRemoveParam(key)}
            className="mt-5 p-1 text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {showParamPicker ? (
        <div className="border border-gray-200 rounded-md p-2 bg-gray-50">
          <div className="text-[10px] font-medium text-gray-500 mb-1">Add Parameter</div>
          {unusedParams.length > 0 ? (
            <div className="space-y-1">
              {unusedParams.map((param) => (
                <button
                  key={param}
                  type="button"
                  onClick={() => handleAddParam(param)}
                  className="w-full px-2 py-1 text-xs text-left rounded hover:bg-blue-50 text-gray-700 transition-colors"
                >
                  {param}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">No available parameters</div>
          )}
          <button
            type="button"
            onClick={() => setShowParamPicker(false)}
            className="mt-2 w-full px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowParamPicker(true)}
          className="w-full px-2 py-1.5 text-xs border border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add Parameter
        </button>
      )}
    </div>
  );
}
