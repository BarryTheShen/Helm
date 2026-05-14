/**
 * SDUIIcon — Tier 2 atomic component.
 * Vector icons. Maps Feather icon names to emoji equivalents for MVP.
 * In production: use @expo/vector-icons Feather set.
 */
import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';
import type { SDUIAction } from '@/types/sdui';

interface SDUIIconProps {
  name: string;
  size?: number;
  color?: string;
  onPress?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}

/** Map common Feather icon names to emoji/unicode equivalents */
const ICON_MAP: Record<string, string> = {
  'send': '➤',
  'settings': '⚙️',
  'search': '🔍',
  'calendar': '📅',
  'edit': '✏️',
  'edit-2': '✏️',
  'trash-2': '🗑️',
  'plus': '+',
  'x': '✕',
  'user': '👤',
  'message-circle': '💬',
  'file-text': '📄',
  'image': '🖼️',
  'home': '🏠',
  'bell': '🔔',
  'bookmark': '🔖',
  'check': '✓',
  'clock': '🕐',
  'download': '⬇️',
  'external-link': '↗',
  'eye': '👁️',
  'filter': '⊟',
  'folder': '📁',
  'heart': '❤️',
  'info': 'ℹ️',
  'link': '🔗',
  'lock': '🔒',
  'log-out': '↪',
  'map-pin': '📍',
  'more-horizontal': '•••',
  'more-vertical': '⋮',
  'phone': '📱',
  'refresh-cw': '↻',
  'save': '💾',
  'share': '↗',
  'star': '⭐',
  'upload': '⬆️',
  'chevron-right': '›',
  'chevron-left': '‹',
  'chevron-down': '⌄',
  'chevron-up': '⌃',
  'copy': '📋',
  'menu': '☰',
  'book-open': '📖',
  'book': '📚',
  'plus-circle': '➕',
  'minus-circle': '➖',
  'notebook-pen': '📝',
  // Travel & lifestyle
  'credit-card': '💳',
  'alert-triangle': '⚠️',
  'notebook': '📓',
  'camera': '📷',
  'pen': '✒️',
  'coffee': '☕',
  'shopping-bag': '🛍️',
  'map': '🗺️',
  'compass': '🧭',
  'globe': '🌍',
  'plane': '✈️',
  'train': '🚆',
  'bus': '🚌',
  'car': '🚗',
  'hotel': '🏨',
  'restaurant': '🍽️',
  'utensils': '🍴',
  'sun': '☀️',
  'cloud': '☁️',
  'umbrella': '☂️',
  'thermometer': '🌡️',
  'flag': '🚩',
  'award': '🏆',
  'gift': '🎁',
  'tag': '🏷️',
  'zap': '⚡',
  'activity': '📊',
  'bar-chart': '📊',
  'pie-chart': '🥧',
  'trending-up': '📈',
  'trending-down': '📉',
  'dollar-sign': '💲',
  'percent': '%',
  'hash': '#',
  'at-sign': '@',
  'mail': '✉️',
  'inbox': '📥',
  'archive': '📦',
  'paperclip': '📎',
  'scissors': '✂️',
  'tool': '🔧',
  'wrench': '🔧',
  'key': '🔑',
  'shield': '🛡️',
  'alert-circle': '⚠️',
  'check-circle': '✅',
  'x-circle': '❌',
  'help-circle': '❓',
  'wifi': '📶',
  'bluetooth': '🔵',
  'battery': '🔋',
  'speaker': '🔊',
  'volume-2': '🔊',
  'mic': '🎤',
  'video': '🎥',
  'music': '🎵',
  'headphones': '🎧',
  'smile': '😊',
  'frown': '☹️',
  'thumbs-up': '👍',
  'thumbs-down': '👎',
};

export function resolveIconName(name: string): string {
  return ICON_MAP[name] ?? name;
}

export function SDUIIcon({
  name,
  size = 24,
  color,
  onPress,
  dispatch,
}: SDUIIconProps) {
  const icon = ICON_MAP[name] ?? name;
  const resolvedColor = resolveColor(color);

  const iconElement = (
    <View style={styles.cellFit}>
      <Text style={[styles.icon, { fontSize: size, color: resolvedColor }]}>
        {icon}
      </Text>
    </View>
  );

  if (onPress && dispatch) {
    return (
      <TouchableOpacity
        onPress={() => dispatch(onPress)}
        style={styles.touchable}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
      >
        {iconElement}
      </TouchableOpacity>
    );
  }

  return iconElement;
}

const styles = StyleSheet.create({
  cellFit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
  },
  touchable: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
