/**
 * SDUITextInput — Tier 2 atomic component.
 * Text entry field, outlined variant for MVP.
 */
import React, { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';
import type { SDUIAction } from '@/types/sdui';

interface SDUITextInputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLines?: number;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  onSubmit?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}

export function SDUITextInput({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLines,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  onSubmit,
  dispatch,
}: SDUITextInputProps) {
  const [localValue, setLocalValue] = useState(value ?? '');

  const handleChangeText = (text: string) => {
    setLocalValue(text);
    onChangeText?.(text);
  };

  const handleSubmitEditing = () => {
    if (!onSubmit || !dispatch || !localValue.trim()) return;
    // For send_to_agent actions, inject the input text as the message
    if (onSubmit.type === 'send_to_agent') {
      dispatch({ ...onSubmit, message: localValue.trim() });
    } else if (onSubmit.type === 'server_action') {
      dispatch({ ...onSubmit, params: { ...(onSubmit.params ?? {}), text: localValue.trim() } });
    } else {
      dispatch(onSubmit);
    }
    setLocalValue('');
  };

  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.multiline,
        !editable && styles.disabled,
      ]}
      value={localValue}
      onChangeText={handleChangeText}
      placeholder={placeholder}
      placeholderTextColor={themeColors.textTertiary}
      multiline={multiline}
      numberOfLines={maxLines}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      editable={editable}
      onSubmitEditing={handleSubmitEditing}
      returnKeyType={onSubmit ? 'send' : 'default'}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 44,
    textAlignVertical: 'top',
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#F2F2F7',
  },
});
