/**
 * NotesModule — Tier 3 composite module.
 * Document feed for notes created by users and AI.
 * Editing uses TextInput; rendering uses SDUIMarkdown (react-native-markdown-display).
 * Supports pull-to-refresh when connected to a data source.
 *
 * New Architecture (react-native-enriched) is NOT used because the app runs
 * on the old architecture. If newArchEnabled is set in app.json in the future,
 * migrate to react-native-enriched for richer editing.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { themeColors } from '@/theme/tokens';
import { SDUIMarkdown } from '@/components/atomic/SDUIMarkdown';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface Note {
  id: string;
  title: string;
  content: string;
}

interface NotesModuleProps {
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
}

export function NotesModule({ dataBinding, onDataRefresh }: NotesModuleProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  const notes: Note[] = dataSourceData && dataSourceData.length > 0
    ? dataSourceData.map((row, i) => ({
        id: String(row.id ?? i),
        title: String(row.title ?? 'Untitled'),
        content: String(row.content ?? ''),
      }))
    : [];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
    }
    const refresh = onDataRefresh ?? dsRefresh;
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh]);

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Notes</Text>
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.placeholder}>Notes feed</Text>
          <Text style={styles.subtext}>Notes will appear here</Text>
        </View>
      ) : (
        notes.map((note) => (
          <View key={note.id} style={styles.noteCard}>
            <Text style={styles.noteTitle}>{note.title}</Text>

            {editingId === note.id ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editor}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  autoFocus
                  placeholder="Write in markdown…"
                  placeholderTextColor="#C7C7CC"
                  textAlignVertical="top"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => startEdit(note)} activeOpacity={0.8}>
                {note.content ? (
                  <SDUIMarkdown content={note.content} />
                ) : (
                  <Text style={styles.emptyContent}>Tap to edit…</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', minHeight: 200 },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerText: { fontSize: 17, fontWeight: '600', color: '#000' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  placeholder: { fontSize: 15, color: '#8E8E93', marginBottom: 4 },
  subtext: { fontSize: 13, color: '#C7C7CC' },
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  noteTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 6 },
  emptyContent: { fontSize: 14, color: '#C7C7CC', fontStyle: 'italic' },
  editContainer: { gap: 8 },
  editor: {
    minHeight: 120,
    fontSize: 15,
    lineHeight: 22,
    color: '#000',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 10,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#C7C7CC' },
  cancelBtnText: { fontSize: 14, color: '#8E8E93' },
});
