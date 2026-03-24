import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '@/theme/colors';

interface InputProps extends TextInputProps {
  // Additional props can be added here
}

export function Input(props: InputProps) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={colors.textTertiary}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
});
