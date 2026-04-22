/**
 * ChatModule — Tier 3 composite module.
 * Multi-threaded ChatGPT-style chat. MVP: text in, text out.
 * Supports pull-to-refresh when connected to a data source.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { themeColors } from '@/theme/tokens';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import { ApiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import type { SDUIDataBinding } from '@/types/sdui';
import type { ChatMessage } from '@/types/api';

interface ChatModuleProps {
  threadId?: string;
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
  showHistory?: boolean;
}

export function ChatModule({ threadId, dataBinding, onDataRefresh, showHistory = false }: ChatModuleProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { token, serverUrl, logout } = useAuthStore();

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  // Load chat history if showHistory is true
  useEffect(() => {
    if (!showHistory || !token || !serverUrl) return;

    const api = new ApiClient(serverUrl, token, logout);
    api.getChatHistory(10, 0)
      .then((response) => {
        // Reverse to show chronological order (oldest first)
        setMessages([...response.messages].reverse());
      })
      .catch((err) => {
        console.error('Failed to load chat history:', err);
      });
  }, [showHistory, token, serverUrl, logout]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
    }
    const refresh = onDataRefresh ?? dsRefresh;
    refresh();

    // Also refresh chat history if enabled
    if (showHistory && token && serverUrl) {
      const api = new ApiClient(serverUrl, token, logout);
      api.getChatHistory(10, 0)
        .then((response) => {
          setMessages([...response.messages].reverse());
        })
        .catch(() => {});
    }

    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh, showHistory, token, serverUrl, logout]);

  // Determine which messages to display
  const displayMessages = dataSourceData && dataSourceData.length > 0
    ? dataSourceData
    : (showHistory ? messages : []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>💬 Chat</Text>
      </View>
      <View style={styles.body}>
        {displayMessages.length > 0 ? (
          displayMessages.map((msg: any, i: number) => {
            const isUser = msg.role === 'user';
            const content = String(msg.content ?? msg.message ?? '');

            return (
              <View
                key={String(msg.id ?? i)}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowAssistant
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant
                ]}>
                  <Text style={[
                    styles.messageText,
                    isUser ? styles.messageTextUser : styles.messageTextAssistant
                  ]}>
                    {content}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <>
            <Text style={styles.placeholder}>Chat module embedded view</Text>
            <Text style={styles.subtext}>Navigate to Chat tab for full experience</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', minHeight: 200 },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerText: { fontSize: 17, fontWeight: '600', color: '#000' },
  body: { padding: 12 },
  placeholder: { fontSize: 15, color: '#8E8E93', marginBottom: 4, textAlign: 'center' },
  subtext: { fontSize: 13, color: '#C7C7CC', textAlign: 'center' },
  messageRow: {
    marginVertical: 4,
    width: '100%',
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowAssistant: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#007AFF',
  },
  messageBubbleAssistant: {
    backgroundColor: '#F2F2F7',
  },
  messageText: {
    fontSize: 15,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAssistant: {
    color: '#000000',
  },
});
