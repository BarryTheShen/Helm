import { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreviewStore } from '@/stores/previewStore';
import { useAuthStore } from '@/stores/authStore';
import { ApiClient } from '@/services/api';

const BANNER_HEIGHT = 48;

export function PreviewBanner() {
  const insets = useSafeAreaInsets();
  const { isPreviewMode, exitPreview } = usePreviewStore();
  const { token, serverUrl, logout, deviceId } = useAuthStore();
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT - insets.top)).current;
  const wasPreviewMode = useRef(isPreviewMode);

  // Animate slide-down when entering, slide-up when exiting
  useEffect(() => {
    if (isPreviewMode && !wasPreviewMode.current) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!isPreviewMode && wasPreviewMode.current) {
      Animated.timing(slideAnim, {
        toValue: -BANNER_HEIGHT - insets.top,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    wasPreviewMode.current = isPreviewMode;
  }, [isPreviewMode, insets.top, slideAnim]);

  const handleExitPreview = async () => {
    if (deviceId && serverUrl && token) {
      try {
        const api = new ApiClient(serverUrl, token, logout);
        await api.exitPreview(deviceId);
      } catch (err) {
        console.error('Failed to exit preview:', err);
      }
    }
    exitPreview();
  };

  if (!isPreviewMode) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: insets.top,
          height: BANNER_HEIGHT + insets.top,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Preview mode active"
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.text} numberOfLines={1}>
          Preview Mode — Admin is previewing changes
        </Text>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExitPreview}
          accessibilityRole="button"
          accessibilityLabel="Exit preview mode"
        >
          <Text style={styles.exitButtonText}>Exit Preview</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#e94560',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  exitButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
