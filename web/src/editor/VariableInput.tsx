import { useState } from 'react';
import { VariablePicker } from './VariablePicker';
import { useVariablePicker } from './useVariablePicker';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  screenComponents?: Array<{ id: string; type: string }>;
}

export function VariableInput({ value, onChange, placeholder, className, multiline, screenComponents }: VariableInputProps) {
  const {
    pickerState,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleClose,
    registerInput,
  } = useVariablePicker();

  const [localValue, setLocalValue] = useState(value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
    handleChange(e);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleKeyDown(e);
  };

  const handleVariableSelect = (variable: string) => {
    handleSelect(variable);
    // Update local value after selection
    setTimeout(() => {
      const input = document.activeElement;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        setLocalValue(input.value);
        onChange(input.value);
      }
    }, 0);
  };

  const commonProps = {
    ref: registerInput,
    value: localValue,
    onChange: handleInputChange,
    onKeyDown: handleInputKeyDown,
    placeholder: placeholder || 'Type @ to insert variables',
    className: className || 'w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500',
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input type="text" {...commonProps} />
      )}
      {pickerState.isOpen && (
        <VariablePicker
          onSelect={handleVariableSelect}
          onClose={handleClose}
          position={pickerState.position}
          filter={pickerState.filter}
          screenComponents={screenComponents}
        />
      )}
    </div>
  );
}
