/**
 * Chat screen — full-featured AI chat UI.
 *
 * Features:
 *  - Streaming text with live cursor
 *  - Collapsible tool-call blocks (shows tool name, input, output)
 *  - Markdown rendering for assistant messages
 *  - New-chat button with history clear
 *  - Connection status indicator
 *  - SDUI override (AI can replace this screen entirely)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { ApiClient } from '@/services/api';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { SDUIMarkdown } from '@/components/atomic/SDUIMarkdown';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';
import type { ChatMessage } from '@/types/api';

// ─── UI-level message types ───────────────────────────────────────────────────
// Superset of the API type — adds tool call messages not persisted to the DB.
type TextMessage = {
  kind: 'text';
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

type ToolMessage = {
  kind: 'tool';
  id: string;
  tool: string;
  result: string;
  status: 'done' | 'error';
};

type UIMessage = TextMessage | ToolMessage;

function apiToUI(msg: ChatMessage): UIMessage {
  return {
    kind: 'text',
    id: msg.id,
    role: (msg.role === 'user' || msg.role === 'assistant') ? msg.role : 'assistant',
    content: msg.content,
  };
}

// ─── Tool call bubble ─────────────────────────────────────────────────────────
function ToolBubble({ msg }: { msg: ToolMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = msg.status === 'done';
  const statusIcon = isDone ? '✓' : '✗';
  const statusColor = isDone ? '#30D158' : '#FF453A';

  // Format result — pretty-print JSON if possible
  let displayResult = msg.result;
  try {
    const parsed = JSON.parse(msg.result);
    displayResult = JSON.stringify(parsed, null, 2);
  } catch {
    // keep as-is if not JSON
  }

  return (
    <View style={styles.toolContainer}>
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        style={styles.toolHeader}
        activeOpacity={0.7}
      >
        <Text style={[styles.toolStatusIcon, { color: statusColor }]}>{statusIcon}</Text>
        <Text style={styles.toolName} numberOfLines={1}>{msg.tool}</Text>
        <Text style={styles.toolChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <ScrollView
          style={styles.toolBody}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.toolResultText}>{displayResult}</Text>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: UIMessage }) {
  if (msg.kind === 'tool') return <ToolBubble msg={msg} />;

  const isUser = msg.role === 'user';

  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isUser ? (
          <Text style={styles.bubbleTextUser}>{msg.content}</Text>
        ) : (
          <SDUIMarkdown content={msg.content || (msg.isStreaming ? '' : '')} />
        )}
        {msg.isStreaming && !msg.content && (
          <Text style={styles.streamingPlaceholder}>●●●</Text>
        )}
        {!!msg.isStreaming && !!msg.content && (
          <Text style={styles.streamingCursor}>▌</Text>
        )}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>How can I help?</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything — I can manage your calendar, send notifications, set up your home screen, and more.
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const handleAction = useActionDispatcher();
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const ws = useWebSocket();
  const { screen: sduiScreen } = useSDUIScreen('chat');

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [apiClient, setApiClient] = useState<ApiClient | null>(null);

  const flatListRef = useRef<FlatList>(null);
  // Stable ref so the WS subscription (set up when ws changes) always calls the
  // current handler version without needing to re-subscribe on every render.
  const wsHandlerRef = useRef<(msg: any) => void>(() => {});

  // ── Scroll to bottom when messages change ────────────────────────────────
  const messagesLen = messages.length;
  useEffect(() => {
    if (messagesLen === 0) return;
    // Use a short delay to allow FlatList to finish layout before scrolling
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    return () => clearTimeout(t);
  }, [messagesLen]);

  // ── Init: load history ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    setApiClient(api);
    api.getChatHistory()
      .then((history) => {
        // API returns messages in descending order; reverse to chronological
        const ui = [...history].reverse().map(apiToUI);
        setMessages(ui);
      })
      .catch(() => showError('Failed to load chat history'));
  }, [token, serverUrl, logout]);

  // ── WebSocket subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!ws) return;
    setIsConnected(ws.isConnected);
    const unsub = ws.onMessage((msg: any) => wsHandlerRef.current(msg));
    const unsubConn = ws.onConnect(() => { setIsConnected(true); hideError(); });
    const unsubDisc = ws.onDisconnect(() => setIsConnected(false));
    return () => { unsub(); unsubConn(); unsubDisc(); };
  }, [ws]);

  // ── WS message handler ───────────────────────────────────────────────────
  const handleWsMessage = useCallback((message: any) => {
    switch (message.type) {

      case 'chat_start': {
        setIsTyping(true);
        const msgId: string = message.message_id ?? `ai-${Date.now()}`;
        setMessages((prev) => {
          // Avoid duplicate bubbles if chat_start fires again in a multi-turn loop
          if (prev.some((m) => m.id === msgId)) return prev;
          return [
            ...prev,
            { kind: 'text', id: msgId, role: 'assistant', content: '', isStreaming: true },
          ];
        });
        break;
      }

      case 'chat_token': {
        const msgId: string = message.message_id;
        const token: string = message.token ?? '';
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msgId);
          if (idx >= 0 && prev[idx].kind === 'text') {
            const updated = [...prev];
            const m = updated[idx] as TextMessage;
            updated[idx] = { ...m, content: m.content + token, isStreaming: true };
            return updated;
          }
          // Fallback: append to last streaming assistant message
          const lastStreamIdx = [...prev.keys()].reverse()
            .find((i) => prev[i].kind === 'text' && (prev[i] as TextMessage).isStreaming);
          if (lastStreamIdx !== undefined) {
            const updated = [...prev];
            const m = updated[lastStreamIdx] as TextMessage;
            updated[lastStreamIdx] = { ...m, content: m.content + token };
            return updated;
          }
          return prev;
        });
        break;
      }

      case 'chat_message_replace': {
        const msgId: string = message.message_id;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msgId);
          if (idx >= 0 && prev[idx].kind === 'text') {
            const updated = [...prev];
            updated[idx] = { ...(updated[idx] as TextMessage), content: message.content };
            return updated;
          }
          return prev;
        });
        break;
      }

      case 'tool_result': {
        const toolName: string = message.tool ?? 'tool';
        const rawResult = message.result;
        const result = typeof rawResult === 'string'
          ? rawResult
          : JSON.stringify(rawResult);
        setMessages((prev) => [
          ...prev,
          { kind: 'tool', id: `tool-${Date.now()}-${Math.random()}`, tool: toolName, result, status: 'done' },
        ]);
        // Proxy is about to make another LLM turn — keep the typing indicator
        setIsTyping(true);
        break;
      }

      case 'tool_error': {
        const toolName: string = message.tool ?? 'tool';
        setMessages((prev) => [
          ...prev,
          {
            kind: 'tool',
            id: `tool-err-${Date.now()}`,
            tool: toolName,
            result: message.message ?? 'Tool error',
            status: 'error',
          },
        ]);
        setIsTyping(true);
        break;
      }

      case 'chat_complete': {
        const msgId: string = message.message_id;
        setIsTyping(false);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msgId);
          if (idx >= 0 && prev[idx].kind === 'text') {
            const updated = [...prev];
            updated[idx] = { ...(updated[idx] as TextMessage), isStreaming: false };
            return updated;
          }
          // Finalize the last streaming message if ID doesn't match
          const lastStreamIdx = [...prev.keys()].reverse()
            .find((i) => prev[i].kind === 'text' && (prev[i] as TextMessage).isStreaming);
          if (lastStreamIdx !== undefined) {
            const updated = [...prev];
            updated[lastStreamIdx] = {
              ...(updated[lastStreamIdx] as TextMessage),
              isStreaming: false,
            };
            return updated;
          }
          return prev;
        });
        break;
      }

      case 'chat_error': {
        setIsTyping(false);
        showError(message.message || 'Chat error occurred');
        break;
      }
    }
  }, [showError]);

  wsHandlerRef.current = handleWsMessage;

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !ws) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { kind: 'text', id: `user-${Date.now()}`, role: 'user', content: text },
    ]);
    ws.send({ type: 'chat_message', content: text, conversation_id: 'default' });
  }, [input, ws]);

  // ── New Chat ─────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    const doClear = async () => {
      if (apiClient) {
        await apiClient.deleteConversation('default').catch(() => {});
      }
      setMessages([]);
      setIsTyping(false);
    };

    if (Platform.OS === 'web') {
      // Alert.alert is unreliable on web — use browser confirm instead
      if (window.confirm('Clear conversation history?')) {
        doClear();
      }
    } else {
      Alert.alert(
        'Start New Chat',
        'This will clear your conversation history. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: doClear },
        ]
      );
    }
  }, [apiClient]);

  // ── SDUI override — AI can push a custom layout to the chat tab ──────────
  if (sduiScreen) {
    return <SDUIUniversalRenderer payload={sduiScreen} onAction={handleAction} />;
  }

  const canSend = !!input.trim() && isConnected;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#30D158' : colors.textTertiary }]} />
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton} activeOpacity={0.7}>
          <Text style={styles.newChatButtonText}>New chat</Text>
        </TouchableOpacity>
      </View>

      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

      {/* ── Message list ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Typing indicator ── */}
      {isTyping && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>AI is thinking</Text>
          <View style={styles.typingDots}>
            <Text style={styles.typingDot}>●</Text>
            <Text style={styles.typingDot}>●</Text>
            <Text style={styles.typingDot}>●</Text>
          </View>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Message…"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={10000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={Platform.OS !== 'web' ? handleSend : undefined}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const USER_COLOR = '#007AFF';
const ASSISTANT_BG = '#F2F2F7';
const TOOL_BG = '#1C1C1E';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 54 : spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text,
  },
  newChatButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  newChatButtonText: {
    ...typography.callout,
    color: colors.primary,
  },

  // Message list
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },

  // Bubbles
  bubbleWrap: {
    marginVertical: 4,
  },
  bubbleWrapUser: {
    alignItems: 'flex-end',
  },
  bubbleWrapAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: USER_COLOR,
  },
  bubbleAssistant: {
    backgroundColor: ASSISTANT_BG,
  },
  bubbleTextUser: {
    ...typography.body,
    color: '#FFFFFF',
  },
  streamingPlaceholder: {
    color: colors.textSecondary,
    fontSize: 14,
    letterSpacing: 2,
  },
  streamingCursor: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Tool call block
  toolContainer: {
    marginVertical: 4,
    marginRight: 48,
    borderRadius: 12,
    backgroundColor: TOOL_BG,
    overflow: 'hidden',
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 6,
  },
  toolStatusIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  toolName: {
    flex: 1,
    ...typography.footnote,
    color: '#E5E5EA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toolChevron: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  toolBody: {
    maxHeight: 180,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  toolResultText: {
    color: '#A8FF78',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },

  // Typing indicator
  typingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  typingText: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    color: colors.textSecondary,
    fontSize: 9,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: USER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
