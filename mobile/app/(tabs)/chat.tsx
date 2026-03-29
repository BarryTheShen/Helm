import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { ApiClient } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SDUIScreenRenderer, type ActionDispatcher } from '@/components/sdui/SDUIRenderer';
import { colors, spacing, typography } from '@/theme/colors';
import type { ChatMessage } from '@/types/api';
import type { SDUIAction } from '@/types/sdui';

const handleAction: ActionDispatcher = (action: SDUIAction) => {
  console.log('[SDUI action]', action);
};

export default function ChatScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const ws = useWebSocket();
  const { screen: sduiScreen } = useSDUIScreen('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [apiClient, setApiClient] = useState<ApiClient | null>(null);
  const flatListRef = useRef<FlatList>(null);
  // Ref to hold the latest handler so the ws.onMessage subscription (set up
  // once when [ws] changes) always calls the current version and is never stale.
  const wsHandlerRef = useRef<(msg: any) => void>(() => {});

  useEffect(() => {
    if (!token || !serverUrl) return;

    const api = new ApiClient(serverUrl, token, logout);
    setApiClient(api);

    // Load chat history
    api.getChatHistory().then((history) => {
      setMessages([...history].reverse());
      scrollToBottom();
    }).catch(() => showError('Failed to load chat history'));
  }, [token, serverUrl, logout]);

  // Subscribe to WebSocket messages via shared connection
  useEffect(() => {
    if (!ws) return;

    const updateConnection = () => setIsConnected(ws.isConnected);
    // Check initial connection state
    updateConnection();

    // Use the ref so hot-reload / re-renders don't leave a stale closure.
    const unsubscribe = ws.onMessage((message: any) => {
      wsHandlerRef.current(message);
    });

    const unsubConnect = ws.onConnect(() => {
      setIsConnected(true);
      hideError();
    });

    const unsubDisconnect = ws.onDisconnect(() => {
      setIsConnected(false);
      showError('Connection lost', () => ws.connect());
    });

    return () => {
      unsubscribe();
      unsubConnect();
      unsubDisconnect();
    };
  }, [ws]);

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'chat_start') {
      setIsTyping(true);
    } else if (message.type === 'chat_token') {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + message.token },
          ];
        }
        return [
          ...prev,
          {
            id: message.message_id || Date.now().toString(),
            conversation_id: 'default',
            role: 'assistant',
            content: message.token,
            created_at: new Date().toISOString(),
          },
        ];
      });
      scrollToBottom();
    } else if (message.type === 'chat_message_replace') {
      // Backend sends this to strip raw <tool_call> XML from the displayed message
      // when using models that don't support native function-calling format.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === message.message_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: message.content };
          return updated;
        }
        return prev;
      });
    } else if (message.type === 'chat_complete') {
      setIsTyping(false);
      scrollToBottom();
    } else if (message.type === 'chat_error') {
      setIsTyping(false);
      showError(message.message || 'Chat error');
    } else if (message.type === 'tool_result') {
      setIsTyping(true);
    } else if (message.type === 'tool_error') {
      console.warn('Tool error:', message.tool, message.message);
    }
  }, [showError]);
  // Keep the ref in sync so the WS subscription always calls the latest handler.
  wsHandlerRef.current = handleWebSocketMessage;

  const handleSend = () => {
    if (!input.trim() || !ws) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      conversation_id: 'default',
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    scrollToBottom();

    ws.send({
      type: 'chat_message',
      content: input.trim(),
      conversation_id: 'default',
    });

    setInput('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Card style={styles.messageCard}>
        <Text style={styles.messageText}>{item.content}</Text>
      </Card>
    </View>
  );

  // If the AI has set an SDUI screen for the chat tab, render that instead
  if (sduiScreen) {
    return <SDUIScreenRenderer screen={sduiScreen} onAction={handleAction} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollToBottom}
        inverted={false}
      />

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>●●●</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          multiline
          maxLength={2000}
        />
        <Button
          title="Send"
          onPress={handleSend}
          disabled={!input.trim() || !isConnected}
          style={styles.sendButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messageList: {
    padding: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  assistantMessage: {
    alignItems: 'flex-start',
  },
  messageCard: {
    maxWidth: '80%',
  },
  messageText: {
    ...typography.body,
    color: colors.text,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    alignSelf: 'flex-end',
  },
});
