import { PillEditor } from './PillEditor';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  screenComponents?: Array<{ id: string; type: string }>;
}

export function VariableInput({ value, onChange, placeholder, className, multiline, screenComponents }: VariableInputProps) {
  return (
    <PillEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      multiline={multiline}
      screenComponents={screenComponents}
    />
  );
}
