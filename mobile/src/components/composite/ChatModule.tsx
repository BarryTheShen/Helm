/**
 * ChatModule — Tier 3 composite module.
 * Multi-threaded ChatGPT-style chat. MVP: text in, text out.
 * Supports pull-to-refresh when connected to a data source.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { themeColors } from '@/theme/tokens';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface ChatModuleProps {
  threadId?: string;
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
}

export function ChatModule({ threadId, dataBinding, onDataRefresh }: ChatModuleProps) {
  const [refreshing, setRefreshing] = useState(false);

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
    }
    const refresh = onDataRefresh ?? dsRefresh;
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh]);

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
        {dataSourceData && dataSourceData.length > 0 ? (
          dataSourceData.map((msg, i) => (
            <View key={String(msg.id ?? i)} style={styles.messageRow}>
              <Text style={styles.messageText}>{String(msg.content ?? msg.message ?? '')}</Text>
            </View>
          ))
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholder: { fontSize: 15, color: '#8E8E93', marginBottom: 4 },
  subtext: { fontSize: 13, color: '#C7C7CC' },
  messageRow: { paddingVertical: 6, width: '100%' },
  messageText: { fontSize: 15, color: '#000' },
});
