import { useState, useEffect, useRef } from 'react';
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
import { WebSocketService } from '@/services/websocket';
import { ApiClient } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, spacing, typography } from '@/theme/colors';
import type { ChatMessage } from '@/types/api';

export default function ChatScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);
  const apiRef = useRef<ApiClient | null>(null);

  useEffect(() => {
    if (!token || !serverUrl) return;

    // Initialize API client
    apiRef.current = new ApiClient(serverUrl, token, logout);

    // Load chat history
    loadHistory();

    // Initialize WebSocket
    const wsUrl = serverUrl.replace('http', 'ws') + '/ws';
    wsRef.current = new WebSocketService(wsUrl, token);

    wsRef.current.onConnect(() => {
      setIsConnected(true);
      hideError();
    });

    wsRef.current.onDisconnect(() => {
      setIsConnected(false);
      showError('Connection lost', () => wsRef.current?.connect());
    });

    wsRef.current.onMessage((message) => {
      handleWebSocketMessage(message);
    });

    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [token, serverUrl]);

  const loadHistory = async () => {
    if (!apiRef.current) return;

    try {
      const history = await apiRef.current.getChatHistory();
      setMessages(history);
    } catch (error) {
      showError('Failed to load chat history');
    }
  };

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'token') {
      setIsTyping(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + message.data.token },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            conversation_id: message.data.conversation_id || 'default',
            role: 'assistant',
            content: message.data.token,
            created_at: new Date().toISOString(),
          },
        ];
      });
    } else if (message.type === 'tool_call_start') {
      // Show tool call indicator
      console.log('Tool call started:', message.data);
    } else if (message.type === 'tool_call_complete') {
      // Show tool call result
      console.log('Tool call completed:', message.data);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !wsRef.current) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      conversation_id: 'default',
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    wsRef.current.send({
      type: 'chat',
      data: {
        message: input.trim(),
        conversation_id: 'default',
      },
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
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
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
