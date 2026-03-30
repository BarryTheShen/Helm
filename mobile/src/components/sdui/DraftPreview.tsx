/**
 * DraftPreview — shows a draft SDUI screen with approve/reject controls.
 *
 * Architecture Decision: Session 2, Section 8 — Human-in-the-Loop.
 * When AI creates/modifies a module layout, it enters "draft" state.
 * User sees this preview modal with three options: Approve, Reject, Reject with feedback.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SDUIScreenRenderer } from '@/components/sdui/SDUIRenderer';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import type { SDUIScreen } from '@/types/sdui';
import { colors, spacing, typography } from '@/theme/colors';

interface DraftPreviewProps {
  draft: SDUIScreen;
  moduleId: string;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function DraftPreview({ draft, moduleId, onApprove, onReject }: DraftPreviewProps) {
  const handleAction = useActionDispatcher();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleApprove = () => {
    Alert.alert(
      'Approve Layout',
      'This will make the AI-generated layout live. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: onApprove },
      ],
    );
  };

  const handleReject = () => {
    if (showFeedback && feedback.trim()) {
      onReject(feedback.trim());
      setShowFeedback(false);
      setFeedback('');
    } else {
      onReject();
    }
  };

  return (
    <View style={styles.container}>
      {/* Draft badge */}
      <View style={styles.draftBanner}>
        <Text style={styles.draftBannerIcon}>✏️</Text>
        <Text style={styles.draftBannerText}>AI Draft — Review before publishing</Text>
      </View>

      {/* Preview of the draft screen */}
      <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
        <SDUIScreenRenderer screen={draft} onAction={handleAction} />
      </ScrollView>

      {/* Feedback input (toggled) */}
      {showFeedback && (
        <View style={styles.feedbackContainer}>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Tell the AI what to change..."
            placeholderTextColor={colors.textSecondary}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={2}
          />
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectButton} onPress={handleReject} activeOpacity={0.8}>
          <Text style={styles.rejectButtonText}>
            {showFeedback ? 'Send Feedback & Reject' : 'Reject'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => setShowFeedback(!showFeedback)}
          activeOpacity={0.8}
        >
          <Text style={styles.feedbackButtonText}>
            {showFeedback ? 'Hide Feedback' : 'Add Feedback'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.approveButton} onPress={handleApprove} activeOpacity={0.8}>
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '40',
  },
  draftBannerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  draftBannerText: {
    ...typography.caption1,
    color: colors.warning,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    padding: spacing.md,
    paddingBottom: 20,
  },
  feedbackContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  rejectButtonText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  feedbackButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  approveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
