/**
 * ArticleCardModule — Tier 3 composite module.
 * Single article card with optional image, title, description, source, and date.
 * Used in news feeds, knowledge bases, and content aggregation screens.
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';

interface ArticleCardModuleProps {
  title?: string;
  description?: string;
  imageUrl?: string;
  publishedAt?: string;
  source?: string;
  onPress?: () => void;
}

export function ArticleCardModule({
  title,
  description,
  imageUrl,
  publishedAt,
  source,
  onPress,
}: ArticleCardModuleProps) {
  const formattedDate = publishedAt
    ? (() => {
        try {
          return new Date(publishedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        } catch {
          return publishedAt;
        }
      })()
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}

      <View style={styles.content}>
        {title ? <Text style={styles.title} numberOfLines={2}>{title}</Text> : null}
        {description ? <Text style={styles.description} numberOfLines={3}>{description}</Text> : null}

        {(source || formattedDate) ? (
          <View style={styles.footer}>
            {source ? <Text style={styles.source}>{source}</Text> : null}
            {formattedDate ? <Text style={styles.date}>{formattedDate}</Text> : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.headline,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  source: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  date: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
});
