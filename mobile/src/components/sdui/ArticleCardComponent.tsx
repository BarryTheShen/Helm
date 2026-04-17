import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Card } from '@/components/common/Card';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';
import type { SDUIAction } from '@/types/sdui';

interface ArticleCardComponentProps {
  title: string;
  description: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
  onPress?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}

export function ArticleCardComponent({
  title,
  description,
  imageUrl,
  publishedAt,
  source,
  onPress,
  dispatch,
}: ArticleCardComponentProps) {
  const handlePress = () => {
    if (onPress && dispatch) {
      dispatch(onPress);
    }
  };

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={styles.card}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>📰</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={3}>
            {description}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.source}>{source}</Text>
            <Text style={styles.date}>{formatDate(publishedAt)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
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
