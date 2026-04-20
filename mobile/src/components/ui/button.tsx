/**
 * ui/button.tsx — React Native Reusables-style Button component.
 * Copy-paste primitive following the shadcn/ui model for React Native.
 * Uses NativeWind for styling with primary/secondary/destructive/outline/ghost variants.
 */
import { Pressable, Text, type PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
}

const variantContainerClass: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 active:bg-blue-600',
  secondary: 'bg-gray-100 active:bg-gray-200',
  destructive: 'bg-red-500 active:bg-red-600',
  outline: 'bg-transparent border border-gray-300 active:bg-gray-50',
  ghost: 'bg-transparent active:bg-gray-100',
};

const variantTextClass: Record<ButtonVariant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-gray-900 font-semibold',
  destructive: 'text-white font-semibold',
  outline: 'text-blue-500 font-semibold',
  ghost: 'text-gray-900 font-semibold',
};

const sizeContainerClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 rounded-md',
  md: 'px-4 py-2 rounded-lg',
  lg: 'px-6 py-3 rounded-xl',
};

const sizeTextClass: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({ variant = 'primary', size = 'md', label, disabled, ...props }: ButtonProps) {
  return (
    <Pressable
      className={`items-center justify-center ${variantContainerClass[variant]} ${sizeContainerClass[size]} ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
    >
      <Text className={`${variantTextClass[variant]} ${sizeTextClass[size]}`}>{label}</Text>
    </Pressable>
  );
}
