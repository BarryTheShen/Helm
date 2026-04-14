/**
 * Keel Demo App — Chat-style interface with inline SDUI screens.
 *
 * Demonstrates the full Keel loop as a natural conversation:
 * 1. User types a message in the input bar
 * 2. Server responds with text + an interactive SDUI screen
 * 3. Screens appear inline in the chat, user taps buttons/submits forms
 * 4. Actions flow back to the server, which responds with new messages + screens
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
import { SDUIPageRenderer, registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

import './WeatherWidget';
registerPreset(PaperPreset);

import type { SDUIAction, SDUIPage } from '@keel/protocol';

const WS_URL = 'ws://localhost:8765/ws';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  screen?: SDUIPage;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const msgIdRef = useRef(0);

  const nextId = () => String(++msgIdRef.current);

  // ── WebSocket ──────────────────────────────────────────────────────

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'screen_update' && data.screen) {
          const msg: ChatMessage = {
            id: nextId(),
            role: 'assistant',
            text: data.text,
            screen: data.screen as SDUIPage,
          };
          setMessages((prev) => [...prev, msg]);
        }
      } catch (e) {
        console.warn('Parse error:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {};

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────

  const send = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    wsRef.current.send(JSON.stringify({ type: 'send_to_agent', message: text.trim() }));
    setInput('');
  }, []);

  // ── Action handler ─────────────────────────────────────────────────

  const handleAction = useCallback((action: SDUIAction) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
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
                    Type a message below. Try "hello", "form", "dashboard", or "buttons".
                    {'\n\n'}The AI will respond with interactive UI that you can tap and explore.
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
                  {msg.text && (
                    <Text style={msg.role === 'user' ? styles.userText : styles.aiText}>
                      {msg.text}
                    </Text>
                  )}
                  {msg.screen && (
                    <View style={styles.screenCard}>
                      <SDUIPageRenderer page={msg.screen} onAction={handleAction} />
                    </View>
                  )}
                </View>
              ))}
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
