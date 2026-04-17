/**
 * Article Reader screen — displays full article content from RSS feed data.
 *
 * Receives article data via route params from ArticleCard onPress navigation.
 * Uses RichTextRendererComponent for markdown content rendering.
 *
 * Route params:
 * - title: string
 * - content: string
 * - imageUrl?: string
 * - source: string
 * - publishedAt: string
 */
import { ScrollView, View, Text, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RichTextRendererComponent } from '@/components/sdui/RichTextRendererComponent';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';

interface ArticleParams {
  title: string;
  content: string;
  imageUrl?: string;
  source: string;
  publishedAt: string;
}

export default function ArticleScreen() {
  const params = useLocalSearchParams<ArticleParams>();
  const { title, content, imageUrl, source, publishedAt } = params;

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.headerImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.meta}>
          <Text style={styles.source}>{source}</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.date}>{formatDate(publishedAt)}</Text>
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <RichTextRendererComponent content={content} theme="light" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  headerImage: {
    width: '100%',
    height: 240,
    backgroundColor: colors.surface,
  },
  header: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.title1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  source: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  separator: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginHorizontal: spacing.xs,
  },
  date: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  contentWrapper: {
    paddingHorizontal: spacing.md,
  },
});
