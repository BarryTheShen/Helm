/**
 * SDUITextInput — Tier 2 atomic component.
 * Text entry field, outlined variant for MVP.
 */
import React, { useState, useEffect } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { themeColors } from '@/theme/tokens';
import { useComponentStateStore } from '@/stores/componentStateStore';
import type { SDUIAction } from '@/types/sdui';

const INPUT_TEMPLATE_TOKEN = '{{input}}';

function replaceInputTemplate(value: string, input: string): string {
  return value.split(INPUT_TEMPLATE_TOKEN).join(input);
}

function hasInputTemplate(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(INPUT_TEMPLATE_TOKEN);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasInputTemplate(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => hasInputTemplate(entry));
  }

  return false;
}

function replaceInputTemplateDeep(value: unknown, input: string): unknown {
  if (typeof value === 'string') {
    return value.includes(INPUT_TEMPLATE_TOKEN) ? replaceInputTemplate(value, input) : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replaceInputTemplateDeep(entry, input));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      accumulator[key] = replaceInputTemplateDeep(entry, input);
      return accumulator;
    }, {});
  }

  return value;
}

function resolveActionWithInput(action: SDUIAction, input: string): SDUIAction {
  if (action.type === 'send_to_agent') {
    if (typeof action.message === 'string' && action.message.includes(INPUT_TEMPLATE_TOKEN)) {
      return { ...action, message: replaceInputTemplate(action.message, input) };
    }

    return { ...action, message: input };
  }

  if (action.type === 'server_action') {
    if (hasInputTemplate(action.params)) {
      return {
        ...action,
        params: replaceInputTemplateDeep(action.params, input) as Record<string, unknown>,
      };
    }

    return {
      ...action,
      params: { ...(action.params ?? {}), text: input },
    };
  }

  return action;
}

interface SDUITextInputProps {
  id?: string;
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
  id,
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
  const { registerComponent, unregisterComponent, setComponentState } = useComponentStateStore();

  useEffect(() => {
    if (!id) return;
    registerComponent(id, { value: '' });
    return () => unregisterComponent(id);
  }, [id]);

  const handleChangeText = (text: string) => {
    setLocalValue(text);
    onChangeText?.(text);
    if (id) {
      setComponentState(id, 'value', text);
    }
  };

  const handleSubmitEditing = () => {
    if (!onSubmit || !dispatch || !localValue.trim()) return;

    dispatch(resolveActionWithInput(onSubmit, localValue.trim()));
    setLocalValue('');
    if (id) {
      setComponentState(id, 'value', '');
    }
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
