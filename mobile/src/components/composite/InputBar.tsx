/**
 * InputBar — Tier 3 composite module.
 * Universal input strip: [TextInput] [Send]
 */
import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
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

interface InputBarProps {
  id?: string;
  placeholder?: string;
  maxLines?: number;
  onSend?: SDUIAction;
  disabled?: boolean;
  dispatch?: (action: SDUIAction) => void;
}

const INPUT_LINE_HEIGHT = 22;
const INPUT_VERTICAL_PADDING = 8;
const INPUT_MIN_HEIGHT = INPUT_LINE_HEIGHT + INPUT_VERTICAL_PADDING * 2;

export function InputBar({
  id,
  placeholder = 'Message...',
  maxLines = 6,
  onSend,
  disabled,
  dispatch,
}: InputBarProps) {
  const [text, setText] = useState('');
  const [contentHeight, setContentHeight] = useState(INPUT_MIN_HEIGHT);
  const { registerComponent, unregisterComponent, setComponentState } = useComponentStateStore();

  useEffect(() => {
    if (!id) return;
    registerComponent(id, { value: '' });
    return () => unregisterComponent(id);
  }, [id]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    if (id) {
      setComponentState(id, 'value', newText);
    }
  };

  const normalizedMaxLines = Number.isFinite(maxLines) ? Math.max(1, Math.trunc(maxLines)) : 6;
  const maxInputHeight = INPUT_LINE_HEIGHT * normalizedMaxLines + INPUT_VERTICAL_PADDING * 2;
  const inputHeight = Math.min(Math.max(contentHeight, INPUT_MIN_HEIGHT), maxInputHeight);
  const inputShouldScroll = contentHeight > maxInputHeight;
  const trimmedText = text.trim();
  const hasActionableSendPath = Boolean(onSend && dispatch);
  const canSend = Boolean(trimmedText) && !disabled && hasActionableSendPath;

  const handleSend = () => {
    if (!canSend || !onSend || !dispatch) return;

    dispatch(resolveActionWithInput(onSend, trimmedText));

    setText('');
    setContentHeight(INPUT_MIN_HEIGHT);
    if (id) {
      setComponentState(id, 'value', '');
    }
  };

  return (
    <View style={styles.container}>
      {/* Text Input */}
      <TextInput
        style={[
          styles.input,
          { height: inputHeight, maxHeight: maxInputHeight },
        ]}
        value={text}
        onChangeText={handleTextChange}
        onContentSizeChange={(event) => {
          setContentHeight(Math.max(INPUT_MIN_HEIGHT, event.nativeEvent.contentSize.height));
        }}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textTertiary}
        multiline
        numberOfLines={1}
        maxLength={4000}
        editable={!disabled}
        scrollEnabled={inputShouldScroll}
      />

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
      >
        <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>➤</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: INPUT_LINE_HEIGHT,
    color: '#000',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: INPUT_VERTICAL_PADDING,
    minHeight: INPUT_MIN_HEIGHT,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E5EA',
  },
  sendIcon: {
    fontSize: 18,
    color: '#fff',
  },
  sendIconDisabled: {
    color: '#C7C7CC',
  },
});
