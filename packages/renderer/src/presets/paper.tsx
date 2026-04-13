/**
 * React Native Paper preset for Keel SDUI.
 *
 * Maps Keel component types to Material Design 3 components from react-native-paper.
 * Usage: registerPreset(PaperPreset)
 *
 * Peer dependency: react-native-paper >= 5.0.0
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Button as PaperButton,
  Text as PaperText,
  TextInput as PaperTextInput,
  Divider as PaperDivider,
  IconButton as PaperIconButton,
  Surface as PaperSurface,
  ActivityIndicator,
} from 'react-native-paper';
import type { SDUIAction } from '@keel/protocol';
import type { Preset } from '../registry/presets';

// --- Button ---
// Keel variants: primary, secondary, ghost, icon, destructive
// Paper modes: contained, outlined, text, contained-tonal, elevated
function PaperButtonAdapter({
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
}: {
  label?: string;
  icon?: string;
  iconPosition?: 'left' | 'right';
  onPress?: SDUIAction;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  dispatch?: (action: SDUIAction) => void;
}) {
  const handlePress = () => {
    if (onPress && dispatch) dispatch(onPress);
  };

  if (variant === 'icon') {
    return (
      <PaperIconButton
        icon={icon ?? 'circle'}
        onPress={handlePress}
        disabled={disabled}
        size={size === 'sm' ? 20 : size === 'lg' ? 32 : 24}
      />
    );
  }

  const modeMap: Record<string, 'contained' | 'outlined' | 'text' | 'contained-tonal'> = {
    primary: 'contained',
    secondary: 'outlined',
    ghost: 'text',
    destructive: 'contained',
  };

  return (
    <PaperButton
      mode={modeMap[variant] ?? 'contained'}
      onPress={handlePress}
      disabled={disabled}
      loading={loading}
      icon={icon && iconPosition === 'left' ? icon : undefined}
      buttonColor={variant === 'destructive' ? '#FF3B30' : undefined}
      textColor={variant === 'destructive' ? '#FFFFFF' : undefined}
      style={fullWidth ? { width: '100%' } : undefined}
      compact={size === 'sm'}
      contentStyle={
        icon && iconPosition === 'right'
          ? { flexDirection: 'row-reverse' }
          : undefined
      }
    >
      {label}
    </PaperButton>
  );
}

// --- Text ---
function PaperTextAdapter({
  content,
  variant = 'body',
  fontSize,
  color,
  bold,
  italic,
  underline,
  strikethrough,
  align,
  numberOfLines,
  selectable,
}: {
  content: string;
  variant?: 'heading' | 'body' | 'caption';
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const paperVariant = variant === 'heading' ? 'headlineMedium' : variant === 'caption' ? 'labelSmall' : 'bodyLarge';

  const textDecorations: string[] = [];
  if (underline) textDecorations.push('underline');
  if (strikethrough) textDecorations.push('line-through');

  return (
    <PaperText
      variant={paperVariant}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        color ? { color } : null,
        fontSize ? { fontSize } : null,
        bold ? { fontWeight: '700' } : null,
        italic ? { fontStyle: 'italic' } : null,
        textDecorations.length > 0 ? { textDecorationLine: textDecorations.join(' ') as any } : null,
        align ? { textAlign: align } : null,
      ]}
    >
      {content}
    </PaperText>
  );
}

// --- TextInput ---
function PaperTextInputAdapter({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLines,
  secureTextEntry,
  keyboardType = 'default',
  editable = true,
  onSubmit,
  dispatch,
}: {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLines?: number;
  secureTextEntry?: boolean;
  keyboardType?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  editable?: boolean;
  onSubmit?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}) {
  const [localValue, setLocalValue] = useState(value ?? '');

  const handleChange = (text: string) => {
    setLocalValue(text);
    onChangeText?.(text);
  };

  const handleSubmit = () => {
    if (!onSubmit || !dispatch || !localValue.trim()) return;
    if (onSubmit.type === 'send_to_agent') {
      dispatch({ ...onSubmit, message: localValue.trim() });
    } else if (onSubmit.type === 'server_action') {
      dispatch({ ...onSubmit, params: { ...(onSubmit.params ?? {}), text: localValue.trim() } });
    } else {
      dispatch(onSubmit);
    }
    setLocalValue('');
  };

  return (
    <PaperTextInput
      mode="outlined"
      value={localValue}
      onChangeText={handleChange}
      placeholder={placeholder}
      multiline={multiline}
      numberOfLines={maxLines}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType as any}
      editable={editable}
      onSubmitEditing={handleSubmit}
      disabled={!editable}
    />
  );
}

// --- Divider ---
function PaperDividerAdapter({
  direction = 'horizontal',
  thickness = 1,
  color,
  indent = 0,
}: {
  direction?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  indent?: number;
}) {
  if (direction === 'vertical') {
    return (
      <View
        style={{
          width: thickness,
          backgroundColor: color ?? '#E5E5EA',
          marginVertical: indent,
          alignSelf: 'stretch',
        }}
      />
    );
  }
  return (
    <PaperDivider
      bold={thickness > 1}
      style={[
        indent ? { marginHorizontal: indent } : null,
        color ? { backgroundColor: color } : null,
      ]}
    />
  );
}

// --- Icon ---
function PaperIconAdapter({
  name,
  size = 24,
  color,
  onPress,
  dispatch,
}: {
  name: string;
  size?: number;
  color?: string;
  onPress?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}) {
  if (onPress && dispatch) {
    return (
      <PaperIconButton
        icon={name}
        size={size}
        iconColor={color}
        onPress={() => dispatch(onPress)}
      />
    );
  }
  // Paper doesn't have a standalone icon component without button, use IconButton with no press
  return (
    <PaperIconButton
      icon={name}
      size={size}
      iconColor={color}
      disabled
      style={{ margin: 0, padding: 0 }}
    />
  );
}

// --- Container (as Paper Surface) ---
function PaperContainerAdapter({
  direction = 'column',
  gap = 0,
  padding = 0,
  backgroundColor,
  borderRadius = 0,
  shadow,
  flex,
  align,
  justify,
  children,
}: {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: 'sm' | 'md' | 'lg';
  flex?: number;
  align?: string;
  justify?: string;
  children?: React.ReactNode;
}) {
  const elevationMap = { sm: 1, md: 2, lg: 4 };
  const elevation = shadow ? (elevationMap[shadow] ?? 0) : 0;

  // Only use Surface if there's elevation or background, otherwise plain View
  if (elevation > 0 || backgroundColor) {
    return (
      <PaperSurface
        elevation={elevation as any}
        style={{
          flexDirection: direction,
          gap,
          padding,
          backgroundColor,
          borderRadius,
          flex,
          alignItems: align as any,
          justifyContent: justify as any,
        }}
      >
        {children}
      </PaperSurface>
    );
  }

  return (
    <View
      style={{
        flexDirection: direction,
        gap,
        padding,
        borderRadius,
        flex,
        alignItems: align as any,
        justifyContent: justify as any,
      }}
    >
      {children}
    </View>
  );
}

/** React Native Paper preset — Material Design 3 components. */
export const PaperPreset: Preset = {
  Button: PaperButtonAdapter,
  Text: PaperTextAdapter,
  TextInput: PaperTextInputAdapter,
  Divider: PaperDividerAdapter,
  Icon: PaperIconAdapter,
  Container: PaperContainerAdapter,
};
