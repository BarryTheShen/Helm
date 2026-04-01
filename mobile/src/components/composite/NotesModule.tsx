/**
 * NotesModule — Tier 3 composite module.
 * Document feed for notes created by users and AI.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { themeColors } from '@/theme/tokens';

interface NotesModuleProps {
  // MVP: no props needed — module manages its own state
}

export function NotesModule({}: NotesModuleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>📝 Notes</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Notes feed</Text>
        <Text style={styles.subtext}>Notes will appear here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', minHeight: 200 },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerText: { fontSize: 17, fontWeight: '600', color: '#000' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholder: { fontSize: 15, color: '#8E8E93', marginBottom: 4 },
  subtext: { fontSize: 13, color: '#C7C7CC' },
});
