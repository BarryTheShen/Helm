/**
 * Demo screen for RichTextRendererComponent
 *
 * To test this component:
 * 1. Import this file in your app
 * 2. Navigate to this screen
 * 3. Verify all markdown elements render correctly
 */
import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RichTextRendererComponent } from '../RichTextRendererComponent';

const SAMPLE_MARKDOWN = `# Welcome to Rich Text Renderer

This component supports **full markdown** rendering with *many features*.

## Text Formatting

You can use **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

## Lists

### Bulleted List
- First item
- Second item with **bold**
- Third item with *italic*

### Numbered List
1. First step
2. Second step
3. Third step

## Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

## Blockquotes

> This is a blockquote with **bold** text.
> It can span multiple lines.

## Links

Visit [React Native](https://reactnative.dev) for documentation.

## Images

![Placeholder](https://via.placeholder.com/600x400)

## Tables

| Feature | Supported | Notes |
|---------|-----------|-------|
| Headings | ✅ | H1-H3 |
| Lists | ✅ | Ordered & Unordered |
| Code | ✅ | Inline & Blocks |
| Links | ✅ | Clickable |
| Images | ✅ | With alt text |
| Tables | ✅ | Multi-column |

## Video Embeds

![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

---

**End of Demo**`;

export function RichTextRendererDemo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  return (
    <View style={[styles.container, theme === 'dark' && styles.darkContainer]}>
      <View style={styles.header}>
        <Text style={[styles.headerText, theme === 'dark' && styles.darkText]}>
          Rich Text Renderer Demo
        </Text>
        <TouchableOpacity
          style={styles.themeButton}
          onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          <Text style={styles.themeButtonText}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <RichTextRendererComponent content={SAMPLE_MARKDOWN} theme={theme} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkContainer: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  darkText: {
    color: '#FFFFFF',
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  themeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
});
