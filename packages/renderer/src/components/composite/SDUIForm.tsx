/**
 * SDUIForm -- Composite component that renders a set of form fields
 * and dispatches a form_submit action with the collected data.
 *
 * Props (from protocol SDUIFormField[]):
 *   form_id: string          -- identifier sent back with the submission
 *   fields: SDUIFormField[]  -- field definitions (type, label, placeholder, etc.)
 *   submitLabel?: string     -- label for the submit button (default: "Submit")
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { themeColors, resolveColor } from '../../theme/tokens';
import type { SDUIAction } from '@keel/protocol';

interface FormFieldDef {
  id: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | boolean | number;
  options?: Array<{ label: string; value: string }>;
}

interface SDUIFormProps {
  form_id: string;
  fields: FormFieldDef[];
  submitLabel?: string;
  dispatch?: (action: SDUIAction) => void;
}

export function SDUIForm({
  form_id,
  fields = [],
  submitLabel = 'Submit',
  dispatch,
}: SDUIFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        initial[field.id] = field.defaultValue;
      } else if (field.type === 'checkbox') {
        initial[field.id] = false;
      } else {
        initial[field.id] = '';
      }
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((fieldId: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => {
      if (prev[fieldId]) {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      return prev;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!dispatch) return;

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id];
        if (val === '' || val === undefined || val === null) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    dispatch({
      type: 'form_submit',
      form_id,
      data: { ...values },
    });
  }, [dispatch, form_id, fields, values]);

  const getKeyboardType = (fieldType: string) => {
    switch (fieldType) {
      case 'email': return 'email-address' as const;
      case 'number': return 'numeric' as const;
      default: return 'default' as const;
    }
  };

  return (
    <View style={styles.container}>
      {fields.map(field => (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.required}> *</Text>}
          </Text>

          {field.type === 'checkbox' ? (
            <View style={styles.checkboxRow}>
              <Switch
                value={!!values[field.id]}
                onValueChange={(val: boolean) => setValue(field.id, val)}
                trackColor={{ false: '#C6C6C8', true: themeColors.primary }}
              />
            </View>
          ) : field.type === 'select' && field.options ? (
            <View style={styles.selectContainer}>
              {field.options.map(opt => {
                const selected = values[field.id] === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.selectOption, selected && styles.selectOptionActive]}
                    onPress={() => setValue(field.id, opt.value)}
                  >
                    <Text style={[styles.selectText, selected && styles.selectTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={[
                styles.input,
                field.type === 'textarea' && styles.textarea,
                errors[field.id] ? styles.inputError : null,
              ]}
              value={String(values[field.id] ?? '')}
              onChangeText={(text: string) => setValue(field.id, field.type === 'number' ? text : text)}
              placeholder={field.placeholder}
              placeholderTextColor={themeColors.textTertiary}
              secureTextEntry={field.type === 'password'}
              keyboardType={getKeyboardType(field.type)}
              multiline={field.type === 'textarea'}
              numberOfLines={field.type === 'textarea' ? 4 : 1}
            />
          )}

          {errors[field.id] && (
            <Text style={styles.errorText}>{errors[field.id]}</Text>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        activeOpacity={0.75}
      >
        <Text style={styles.submitLabel}>{submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    backgroundColor: '#FFFFFF',
  },
  selectOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  selectText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  selectTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
