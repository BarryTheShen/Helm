/**
 * Keel Demo App — AI chat interface with inline SDUI screens.
 *
 * A natural chat experience where the AI responds conversationally and
 * renders interactive Keel SDUI screens inline when rich UI is helpful.
 *
 * Run: cd examples/keel-demo && npm install && npx expo start
 * Server: cd examples/keel-demo/server && uvicorn main:app --port 8765
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider, Text } from 'react-native-paper';
import { SDUIPageRenderer, SDUIMarkdown, registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

import './WeatherWidget';
registerPreset(PaperPreset);

import type { SDUIAction, SDUIPage } from '@keel/protocol';

const WS_URL = 'ws://localhost:8765/ws';

// Error boundary to catch silent rendering crashes
class SDUIErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[KEEL:ErrorBoundary] Renderer crashed:', error.message);
    console.error('[KEEL:ErrorBoundary] Stack:', info.componentStack);
  }
  render() {
    if (this.state.error) {
      return React.createElement(View, { style: { padding: 12, backgroundColor: '#FFE0E0', borderRadius: 8 } },
        React.createElement(Text, { style: { color: '#D32F2F', fontWeight: '600' } }, 'SDUI Render Error:'),
        React.createElement(Text, { style: { color: '#D32F2F', fontSize: 12, marginTop: 4 } }, this.state.error.message),
      );
    }
    return this.props.children;
  }
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  screen?: SDUIPage;
  streaming?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const msgIdRef = useRef(0);
  const streamingIdRef = useRef<string | null>(null);

  const nextId = () => String(++msgIdRef.current);

  // ── WebSocket ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        console.log('[KEEL] WS connected');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'text_delta') {
            // Streaming text — append to current streaming message
            setIsTyping(false);
            setMessages((prev) => {
              const streamId = streamingIdRef.current;
              if (!streamId) {
                // Create new streaming message
                const newId = nextId();
                streamingIdRef.current = newId;
                return [...prev, {
                  id: newId,
                  role: 'assistant' as const,
                  text: data.delta,
                  streaming: true,
                }];
              }
              // Append to existing streaming message
              return prev.map((msg) =>
                msg.id === streamId
                  ? { ...msg, text: (msg.text || '') + data.delta }
                  : msg
              );
            });
          } else if (data.type === 'response_done') {
            // Final response — finalize streaming message or create new one
            setIsTyping(false);
            const streamId = streamingIdRef.current;
            streamingIdRef.current = null;

            if (streamId) {
              // Finalize the streaming message with screen if present
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamId
                    ? {
                        ...msg,
                        text: data.text || msg.text,
                        screen: data.screen as SDUIPage | undefined,
                        streaming: false,
                      }
                    : msg
                )
              );
            } else {
              // No streaming happened — create complete message
              setMessages((prev) => [...prev, {
                id: nextId(),
                role: 'assistant' as const,
                text: data.text,
                screen: data.screen as SDUIPage | undefined,
              }]);
            }
          } else if (data.type === 'screen_update' && data.screen) {
            // Legacy screen_update for backwards compatibility
            setMessages((prev) => [...prev, {
              id: nextId(),
              role: 'assistant' as const,
              text: data.text,
              screen: data.screen as SDUIPage,
            }]);
          }
        } catch (e) {
          console.warn('[KEEL] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        console.log('[KEEL] WS disconnected, will reconnect in 3s');
        setConnected(false);
        setIsTyping(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (e) => console.warn('[KEEL] WS error:', e);

      wsRef.current = ws;
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────

  const send = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    streamingIdRef.current = null;
    wsRef.current.send(JSON.stringify({ type: 'send_to_agent', message: text.trim() }));
    setInput('');
  }, []);

  // ── Action handler ─────────────────────────────────────────────────

  const handleAction = useCallback((action: SDUIAction) => {
    console.log('[KEEL] Action dispatched:', JSON.stringify(action));
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[KEEL] WS not open, cannot dispatch action');
      return;
    }
    setIsTyping(true);
    streamingIdRef.current = null;
    wsRef.current.send(JSON.stringify(action));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.headerTitle}>Keel Demo</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: connected ? '#4CAF50' : '#F44336' }]} />
              <Text variant="labelSmall" style={styles.statusText}>
                {connected ? 'Connected' : 'Reconnecting...'}
              </Text>
            </View>
          </View>

          {/* Chat */}
          <KeyboardAvoidingView
            style={styles.chatArea}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {messages.length === 0 && connected && (
                <View style={styles.empty}>
                  <Text variant="headlineSmall" style={styles.emptyTitle}>Welcome to Keel</Text>
                  <Text style={styles.emptyHint}>
                    Chat naturally with the AI assistant. It can answer questions,
                    help with tasks, and show interactive UI when it's useful.
                  </Text>
                </View>
              )}

              {messages.length === 0 && !connected && (
                <View style={styles.empty}>
                  <Text style={styles.emptyHint}>
                    Start the server:{'\n'}cd server && uvicorn main:app --port 8765
                  </Text>
                </View>
              )}

              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {msg.text ? (
                    msg.role === 'user' ? (
                      <Text style={styles.userText}>{msg.text}</Text>
                    ) : (
                      <View style={styles.aiTextWrap}>
                        <SDUIMarkdown content={msg.text} />
                        {msg.streaming && <Text style={styles.cursor}>|</Text>}
                      </View>
                    )
                  ) : null}
                  {msg.screen && (
                    <View style={styles.screenCard}>
                      <SDUIErrorBoundary>
                        <SDUIPageRenderer page={msg.screen} onAction={handleAction} />
                      </SDUIErrorBoundary>
                    </View>
                  )}
                </View>
              ))}

              {isTyping && (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <Text style={styles.typingText}>Thinking...</Text>
                </View>
              )}
            </ScrollView>

            {/* Input bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder={connected ? 'Type a message...' : 'Waiting for server...'}
                placeholderTextColor="#999"
                editable={connected}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || !connected) && styles.sendBtnDisabled]}
                onPress={() => send(input)}
                disabled={!input.trim() || !connected}
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#666',
  },
  chatArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  emptyHint: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  aiText: {
    color: '#333',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  aiTextWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  typingText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cursor: {
    color: '#007AFF',
    fontWeight: '300',
  },
  screenCard: {
    padding: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
