/**
 * NotesModule — Tier 3 composite module.
 * Document feed for notes created by users and AI.
 * Editing uses TextInput; rendering uses SDUIText (markdown-based).
 * Supports pull-to-refresh when connected to a data source.
 *
 * Backend integration:
 *  - Load: via dataBinding prop (useDataSource hook)
 *  - Create/Update: via dispatch (server_action to backend notes API)
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
import { SDUIText } from '@/components/atomic/SDUIText';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIAction, SDUIDataBinding } from '@/types/sdui';

interface Note {
  id: string;
  title: string;
  content: string;
}

interface NotesModuleProps {
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
  /** Create action — SDUIAction dispatched when creating a new note */
  onCreate?: SDUIAction;
  /** Save action — SDUIAction dispatched when saving an edited note */
  onSave?: SDUIAction;
  /** Injected by the SDUI renderer */
  dispatch?: (action: SDUIAction) => void;
}

export function NotesModule({ dataBinding, onDataRefresh, onCreate, onSave, dispatch }: NotesModuleProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');

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
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditTitle('');
  };

  const saveEdit = () => {
    if (!editingId || !dispatch || !onSave) return;
    dispatch({
      ...onSave,
      params: { ...((onSave as Record<string, unknown>).params as Record<string, unknown> ?? {}), id: editingId, title: editTitle, content: editContent },
    } as SDUIAction);
    cancelEdit();
  };

  const handleCreate = () => {
    if (!dispatch || !onCreate) return;
    dispatch(onCreate);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Notes</Text>
        {onCreate && dispatch && (
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
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
                  style={styles.titleEditor}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Note title…"
                  placeholderTextColor="#C7C7CC"
                />
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
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={!onSave}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => startEdit(note)} activeOpacity={0.8}>
                {note.content ? (
                  <SDUIText content={note.content} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerText: { fontSize: 17, fontWeight: '600', color: '#000' },
  createBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: themeColors.primary, borderRadius: 6 },
  createBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
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
  titleEditor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 10,
  },
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
  saveBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: themeColors.primary },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#C7C7CC' },
  cancelBtnText: { fontSize: 14, color: '#8E8E93' },
});
