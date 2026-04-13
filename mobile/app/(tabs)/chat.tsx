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
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { ApiClient } from '@/services/api';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { colors, spacing, typography } from '@/theme/colors';
import type { ChatMessage, Conversation } from '@/types/api';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.8;

export default function ChatScreen() {
  const handleAction = useActionDispatcher();
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const ws = useWebSocket();
  const { screen: sduiScreen } = useSDUIScreen('chat');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [apiClient, setApiClient] = useState<ApiClient | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const wsHandlerRef = useRef<(msg: any) => void>(() => {});

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Initialize API client and load conversations
  useEffect(() => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    setApiClient(api);
    loadConversations(api);
  }, [token, serverUrl, logout]);

  const loadConversations = async (api: ApiClient) => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
      // Auto-select the most recent conversation, or stay on none (new chat state)
      if (convs.length > 0 && !activeConversationId) {
        selectConversation(convs[0].id, api);
      }
    } catch {
      // Silently fail — conversations are a new feature, server might not support yet
    }
  };

  const selectConversation = async (convId: string, api?: ApiClient) => {
    const client = api || apiClient;
    if (!client) return;

    setActiveConversationId(convId);
    setMessages([]);
    setIsTyping(false);

    try {
      const history = await client.getChatHistory(convId);
      setMessages([...history].reverse());
      scrollToBottom();
    } catch {
      showError('Failed to load chat history');
    }

    closeDrawer();
  };

  const handleNewChat = async () => {
    if (!apiClient) return;
    try {
      const conv = await apiClient.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      setIsTyping(false);
      closeDrawer();
    } catch {
      showError('Failed to create conversation');
    }
  };

  const handleDeleteConversation = (convId: string, title: string) => {
    Alert.alert('Delete Chat', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!apiClient) return;
          try {
            await apiClient.deleteConversation(convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            if (activeConversationId === convId) {
              setActiveConversationId(null);
              setMessages([]);
            }
          } catch {
            showError('Failed to delete conversation');
          }
        },
      },
    ]);
  };

  // Drawer animation
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeDrawer = () => {
    Animated.spring(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start(() => setDrawerOpen(false));
  };

  // WebSocket setup
  useEffect(() => {
    if (!ws) return;
    setIsConnected(ws.isConnected);

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
            conversation_id: activeConversationId || 'default',
            role: 'assistant',
            content: message.token,
            created_at: new Date().toISOString(),
          },
        ];
      });
      scrollToBottom();
    } else if (message.type === 'chat_message_replace') {
      setMessages((prev) => {
        let idx = prev.findIndex((m) => m.id === message.message_id);
        if (idx < 0) {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === 'assistant') { idx = i; break; }
          }
        }
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: message.content };
          return updated;
        }
        return prev;
      });
    } else if (message.type === 'chat_complete') {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              id: message.message_id || last.id,
              content: message.content || last.content,
            },
          ];
        }
        return prev;
      });
      setIsTyping(false);
      scrollToBottom();
      // Refresh conversation list to update titles/previews
      if (apiClient) loadConversations(apiClient);
    } else if (message.type === 'chat_error') {
      setIsTyping(false);
      showError(message.message || 'Chat error');
    } else if (message.type === 'tool_result') {
      setIsTyping(true);
    } else if (message.type === 'tool_error') {
      // Tool errors are logged but don't interrupt the chat flow
    }
  }, [showError, activeConversationId, apiClient]);
  wsHandlerRef.current = handleWebSocketMessage;

  const handleSend = async () => {
    if (!input.trim() || !ws) return;

    // Auto-create conversation if none is active
    let convId = activeConversationId;
    if (!convId && apiClient) {
      try {
        const conv = await apiClient.createConversation();
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
        convId = conv.id;
      } catch {
        showError('Failed to create conversation');
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      conversation_id: convId || 'default',
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
      conversation_id: convId,
    });

    setInput('');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>H</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAssistant]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isUser ? styles.timeTextUser : styles.timeTextAssistant]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isActive = item.id === activeConversationId;
    return (
      <TouchableOpacity
        style={[styles.convItem, isActive && styles.convItemActive]}
        onPress={() => selectConversation(item.id)}
        onLongPress={() => handleDeleteConversation(item.id, item.title)}
        activeOpacity={0.7}
      >
        <View style={styles.convItemContent}>
          <Text style={[styles.convTitle, isActive && styles.convTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.last_message_preview && (
            <Text style={styles.convPreview} numberOfLines={1}>
              {item.last_message_preview}
            </Text>
          )}
        </View>
        <Text style={styles.convDate}>{formatRelativeDate(item.updated_at)}</Text>
      </TouchableOpacity>
    );
  };

  if (sduiScreen) {
    return <SDUIUniversalRenderer payload={sduiScreen} onAction={handleAction} />;
  }

  return (
    <View style={styles.container}>
      {/* Conversation Drawer */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeDrawer}
        />
      )}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Chats</Text>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatIcon}>+</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.convList}
          ListEmptyComponent={
            <View style={styles.convEmpty}>
              <Text style={styles.convEmptyText}>No conversations yet</Text>
              <Text style={styles.convEmptyHint}>Tap + to start a new chat</Text>
            </View>
          }
        />
      </Animated.View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        {/* Header bar with drawer toggle */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={openDrawer} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{'\u2630'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title || 'Chat'
              : 'New Chat'}
          </Text>
          <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{'\u270E'}</Text>
          </TouchableOpacity>
        </View>

        {errorBanner && (
          <ErrorBanner
            message={errorBanner.message}
            onRetry={errorBanner.retry}
            onDismiss={hideError}
          />
        )}

        {!isConnected && (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" color={colors.warning} />
            <Text style={styles.statusText}>Reconnecting...</Text>
          </View>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isTyping && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>H</Text>
            <Text style={styles.emptyTitle}>Helm AI</Text>
            <Text style={styles.emptySubtitle}>
              Ask me to build any UI, manage your calendar, or help with tasks.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && { flex: 1 },
          ]}
          onContentSizeChange={scrollToBottom}
          inverted={false}
        />

        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>H</Text>
            </View>
            <View style={styles.typingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message Helm..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={10000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || !isConnected) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || !isConnected}
              activeOpacity={0.7}
            >
              <Text style={[styles.sendIcon, (!input.trim() || !isConnected) && styles.sendIconDisabled]}>
                {'\u2191'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Drawer
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.surface,
    zIndex: 20,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.divider,
    paddingTop: 60,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  drawerTitle: {
    ...typography.title2,
    color: colors.text,
  },
  newChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  convList: {
    paddingVertical: spacing.sm,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginHorizontal: spacing.sm,
    borderRadius: 10,
  },
  convItemActive: {
    backgroundColor: colors.primary + '15',
  },
  convItemContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  convTitle: {
    ...typography.subheadline,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  convTitleActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  convPreview: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  convDate: {
    ...typography.caption2,
    color: colors.textTertiary,
  },
  convEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  convEmptyText: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  convEmptyHint: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
    paddingTop: 54,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 22,
    color: colors.primary,
  },
  headerTitle: {
    flex: 1,
    ...typography.headline,
    color: colors.text,
    textAlign: 'center',
  },
  // Chat area
  chatArea: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#FFF8E1',
    gap: 8,
  },
  statusText: {
    ...typography.caption1,
    color: colors.warning,
    fontWeight: '500',
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 100,
    zIndex: -1,
  },
  emptyIcon: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
    width: 80,
    height: 80,
    lineHeight: 80,
    textAlign: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 40,
    overflow: 'hidden',
  },
  emptyTitle: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Messages
  messageList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAssistant: {
    color: colors.text,
  },
  timeText: {
    ...typography.caption2,
    marginTop: 4,
  },
  timeTextUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timeTextAssistant: {
    color: colors.textTertiary,
  },
  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  typingBubble: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
  // Input
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    backgroundColor: colors.divider,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  sendIconDisabled: {
    color: colors.textTertiary,
  },
});
