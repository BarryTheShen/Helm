/**
 * SDUIButton — Tier 2 atomic component.
 * 5 variants: primary, secondary, ghost, icon, destructive.
 * 3 sizes: sm, md, lg.
 */
import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';
import { resolveIconName } from '@/components/atomic/SDUIIcon';
import type { SDUIAction } from '@/types/sdui';

interface SDUIButtonProps {
  label?: string;
  icon?: string;
  iconPosition?: 'left' | 'right';
  onPress?: SDUIAction;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  // The renderer passes down the action dispatcher
  dispatch?: (action: SDUIAction) => void;
}

const sizeHeights = { sm: 32, md: 44, lg: 56 };
const sizeFontSizes = { sm: 14, md: 16, lg: 18 };
const sizePadding = { sm: 8, md: 12, lg: 16 };

export function SDUIButton({
  label,
  icon,
  iconPosition = 'left',
  onPress,
  disabled,
  loading,
  fullWidth,
  variant = 'primary',
  size = 'md',
  dispatch,
}: SDUIButtonProps) {
  const height = sizeHeights[size] ?? 44;
  const fontSize = sizeFontSizes[size] ?? 16;
  const px = sizePadding[size] ?? 12;

  const handlePress = () => {
    if (disabled || loading || !onPress || !dispatch) return;
    dispatch(onPress);
  };

  const variantStyle = getVariantStyle(variant);

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <TouchableOpacity
        style={[
          styles.iconOnly,
          { minWidth: 44, minHeight: 44 },
          disabled && styles.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label ?? icon}
      >
        {loading ? (
          <ActivityIndicator size="small" color={themeColors.primary} />
        ) : (
          <Text style={[styles.iconText, { fontSize: height * 0.5, color: resolveColor(variantStyle.text) }]}>
            {icon}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          height,
          paddingHorizontal: px,
          backgroundColor: variant === 'secondary' ? 'transparent' : resolveColor(variantStyle.bg),
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: variant === 'secondary' ? themeColors.primary : 'transparent',
        },
        fullWidth && { width: '100%' },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={resolveColor(variantStyle.text)} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Text style={[styles.btnIcon, { fontSize, color: resolveColor(variantStyle.text) }]}>{resolveIconName(icon)}</Text>
          )}
          {label && (
            <Text style={[styles.label, { fontSize, color: resolveColor(variantStyle.text) }]}>{label}</Text>
          )}
          {icon && iconPosition === 'right' && (
            <Text style={[styles.btnIcon, { fontSize, color: resolveColor(variantStyle.text) }]}>{resolveIconName(icon)}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function getVariantStyle(variant: string): { bg: string; text: string } {
  switch (variant) {
    case 'primary': return { bg: 'primary', text: '#FFFFFF' };
    case 'secondary': return { bg: 'transparent', text: 'primary' };
    case 'ghost': return { bg: 'transparent', text: 'primary' };
    case 'destructive': return { bg: 'error', text: '#FFFFFF' };
    case 'icon': return { bg: 'transparent', text: 'primary' };
    default: return { bg: 'primary', text: '#FFFFFF' };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: '600',
  },
  btnIcon: {},
  iconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconText: {},
  disabled: {
    opacity: 0.4,
  },
});
