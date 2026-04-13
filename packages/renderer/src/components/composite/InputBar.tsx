/**
 * InputBar — Tier 3 composite module.
 * Universal input strip: [Settings] [TextInput] [Send]
 */
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { themeColors } from '../../theme/tokens';
import type { SDUIAction } from '@keel/protocol';

interface SettingsItem {
  label: string;
  value: string;
  options: string[];
}

interface InputBarProps {
  placeholder?: string;
  settingsItems?: SettingsItem[] | null;
  maxLines?: number;
  onSend?: SDUIAction;
  disabled?: boolean;
  dispatch?: (action: SDUIAction) => void;
}

export function InputBar({
  placeholder = 'Message...',
  settingsItems,
  maxLines = 6,
  onSend,
  disabled,
  dispatch,
}: InputBarProps) {
  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    if (onSend && dispatch) {
      // Inject the typed text into the action
      if (onSend.type === 'send_to_agent') {
        dispatch({ ...onSend, message: text.trim() });
      } else if (onSend.type === 'server_action') {
        dispatch({ ...onSend, params: { ...(onSend.params ?? {}), text: text.trim() } });
      } else {
        dispatch(onSend);
      }
    }
    setText('');
  };

  const hasSettings = settingsItems && settingsItems.length > 0;

  return (
    <View style={styles.container}>
      {/* Settings Button */}
      {hasSettings && (
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      )}

      {/* Text Input */}
      <TextInput
        style={[styles.input, !hasSettings && styles.inputNoSettings]}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textTertiary}
        multiline
        numberOfLines={1}
        maxLength={4000}
        editable={!disabled}
      />

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendBtn, (!text.trim() || disabled) && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={[styles.sendIcon, (!text.trim() || disabled) && styles.sendIconDisabled]}>➤</Text>
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
  settingsBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  settingsIcon: { fontSize: 20 },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 132, // ~6 lines
  },
  inputNoSettings: {},
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
