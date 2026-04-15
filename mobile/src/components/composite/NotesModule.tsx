/**
 * NotesModule — Tier 3 composite module.
 * Document feed for notes created by users and AI.
 * Supports pull-to-refresh when connected to a data source.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { themeColors } from '@/theme/tokens';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface NotesModuleProps {
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
}

export function NotesModule({ dataBinding, onDataRefresh }: NotesModuleProps) {
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
        <Text style={styles.headerText}>📝 Notes</Text>
      </View>
      <View style={styles.body}>
        {dataSourceData && dataSourceData.length > 0 ? (
          dataSourceData.map((note, i) => (
            <View key={String(note.id ?? i)} style={styles.noteRow}>
              <Text style={styles.noteTitle}>{String(note.title ?? 'Untitled')}</Text>
              {note.content ? (
                <Text style={styles.noteContent} numberOfLines={2}>
                  {String(note.content)}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <>
            <Text style={styles.placeholder}>Notes feed</Text>
            <Text style={styles.subtext}>Notes will appear here</Text>
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
  noteRow: { paddingVertical: 8, width: '100%', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  noteTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 2 },
  noteContent: { fontSize: 14, color: '#8E8E93' },
});
