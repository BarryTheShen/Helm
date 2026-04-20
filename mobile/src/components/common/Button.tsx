import { TouchableOpacity, Text, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  const baseClass = 'py-2 px-4 rounded-lg items-center justify-center';

  const variantClass =
    variant === 'primary'
      ? 'bg-blue-500'
      : variant === 'secondary'
        ? 'bg-gray-100'
        : 'bg-transparent border border-gray-300';

  const textClass =
    variant === 'primary'
      ? 'text-white text-base font-semibold'
      : variant === 'secondary'
        ? 'text-black text-base font-semibold'
        : 'text-blue-500 text-base font-semibold';

  return (
    <TouchableOpacity
      className={`${baseClass} ${variantClass} ${disabled ? 'opacity-50' : ''}`}
      style={style}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text className={textClass}>{title}</Text>
    </TouchableOpacity>
  );
}
