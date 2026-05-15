/**
 * SDUIImage — Tier 2 atomic component.
 * Simplified: only src and fitMode. action/onPress removed per FF4-IMG-002.
 * fitWidth: image fills cell width, height auto (maintains aspect ratio).
 * fitHeight: image fills cell height, width auto.
 */
import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { themeColors } from '@/theme/tokens';

interface SDUIImageProps {
  src: string;
  fitMode?: 'fitWidth' | 'fitHeight';
}

export function SDUIImage({
  src,
  fitMode = 'fitWidth',
}: SDUIImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const sizeStyle: any = fitMode === 'fitHeight'
    ? { width: '100%', height: '100%' }
    : { width: '100%', aspectRatio: 16 / 9 };

  const resizeModeVal = fitMode === 'fitHeight' ? 'contain' : 'cover';

  return (
    <View style={[styles.container, sizeStyle]}>
      {loading && (
        <View style={[styles.placeholder, sizeStyle]}>
          <ActivityIndicator size="small" color={themeColors.textSecondary} />
        </View>
      )}
      {!error ? (
        <Image
          source={{ uri: src }}
          style={[styles.image, sizeStyle]}
          resizeMode={resizeModeVal}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      ) : (
        <View style={[styles.errorPlaceholder, sizeStyle]}>
          <Text style={styles.errorText}>🖼️</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: {
    position: 'absolute',
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  errorPlaceholder: {
    backgroundColor: '#F2F2F7',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 32,
    opacity: 0.4,
  },
});
