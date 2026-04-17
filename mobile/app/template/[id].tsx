import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { ApiClient } from '@/services/api';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, spacing, typography } from '@/theme/colors';
import type { TemplateDetail } from '@/types/api';

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (token && serverUrl && id) {
      loadTemplate();
    }
  }, [token, serverUrl, id]);

  const loadTemplate = async () => {
    if (!token || !serverUrl || !id) return;

    try {
      setLoading(true);
      const api = new ApiClient(serverUrl, token, logout);
      const data = await api.getTemplateDetail(id);
      setTemplate(data);
      hideError();
    } catch (error) {
      showError('Failed to load template', loadTemplate);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!template || !token || !serverUrl) return;

    Alert.prompt(
      'Apply Template',
      'Enter a module ID for this template:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Apply',
          onPress: async (moduleId) => {
            if (!moduleId || !moduleId.trim()) {
              Alert.alert('Error', 'Module ID is required');
              return;
            }

            try {
              setApplying(true);
              const api = new ApiClient(serverUrl, token, logout);
              await api.applyTemplate(template.id, moduleId.trim());
              Alert.alert('Success', 'Template applied successfully', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to apply template');
            } finally {
              setApplying(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Template not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.headerCard}>
          <Text style={styles.templateName}>{template.name}</Text>
          {template.description && (
            <Text style={styles.templateDescription}>{template.description}</Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{template.category}</Text>
            </View>
            {template.is_public && (
              <View style={styles.publicBadge}>
                <Text style={styles.publicText}>Public</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>
            Created: {new Date(template.created_at).toLocaleDateString()}
          </Text>
        </Card>

        <Card style={styles.previewCard}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <Text style={styles.previewText}>
            This template contains {template.screen_json?.rows?.length || 0} rows
          </Text>
        </Card>

        <TouchableOpacity
          style={[styles.applyButton, applying && styles.applyButtonDisabled]}
          onPress={handleApplyTemplate}
          disabled={applying}
          activeOpacity={0.7}
        >
          {applying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyButtonText}>Apply Template</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  headerCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  templateName: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  templateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
  },
  categoryText: {
    ...typography.caption1,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  publicBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.success + '20',
  },
  publicText: {
    ...typography.caption1,
    color: colors.success,
    fontWeight: '600',
  },
  dateText: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  previewCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  previewText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    ...typography.headline,
    color: '#FFFFFF',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
