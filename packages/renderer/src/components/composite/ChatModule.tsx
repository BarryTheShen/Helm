/**
 * ChatModule — Tier 3 composite module.
 * Multi-threaded ChatGPT-style chat. MVP: text in, text out.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { themeColors } from '../../theme/tokens';

interface ChatModuleProps {
  threadId?: string;
}

export function ChatModule({ threadId }: ChatModuleProps) {
  // MVP: ChatModule renders as a placeholder indicating it's a composite module.
  // The actual chat functionality is handled by the chat tab screen.
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>💬 Chat</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Chat module embedded view</Text>
        <Text style={styles.subtext}>Navigate to Chat tab for full experience</Text>
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
