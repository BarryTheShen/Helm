/**
 * SDUIImage — Tier 2 atomic component.
 * Display images from URLs with proper sizing and placeholders.
 */
import React, { useState } from 'react';
import { Image, View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { resolveColor, themeColors } from '../../theme/tokens';
import type { SDUIAction } from '@keel/protocol';

interface SDUIImageProps {
  src: string;
  alt?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;
  borderRadius?: number;
  onPress?: SDUIAction;
  placeholder?: 'blur' | 'skeleton' | 'none';
  dispatch?: (action: SDUIAction) => void;
}

export function SDUIImage({
  src,
  alt,
  resizeMode = 'contain',
  width,
  height,
  aspectRatio,
  borderRadius = 0,
  onPress,
  placeholder = 'skeleton',
  dispatch,
}: SDUIImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const sizeStyle: any = {};
  if (width !== undefined) sizeStyle.width = width;
  if (height !== undefined) sizeStyle.height = height;
  if (aspectRatio !== undefined) sizeStyle.aspectRatio = aspectRatio;
  // Ensure we have some dimension constraint
  if (!width && !height && !aspectRatio) {
    sizeStyle.width = '100%';
    sizeStyle.aspectRatio = 16 / 9;
  }

  const imageElement = (
    <View style={[styles.container, sizeStyle, { borderRadius }]}>
      {loading && placeholder !== 'none' && (
        <View style={[styles.placeholder, sizeStyle, { borderRadius }]}>
          <ActivityIndicator size="small" color={themeColors.textSecondary} />
        </View>
      )}
      {!error ? (
        <Image
          source={{ uri: src }}
          style={[styles.image, sizeStyle, { borderRadius }]}
          resizeMode={resizeMode}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          accessibilityLabel={alt}
        />
      ) : (
        <View style={[styles.errorPlaceholder, sizeStyle, { borderRadius }]} />
      )}
    </View>
  );

  if (onPress && dispatch) {
    return (
      <TouchableOpacity onPress={() => dispatch(onPress)} activeOpacity={0.8}>
        {imageElement}
      </TouchableOpacity>
    );
  }

  return imageElement;
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
  },
});
