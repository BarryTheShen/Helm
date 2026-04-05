import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { FormField } from '@/types/sdui';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { colors, spacing, typography } from '@/theme/colors';

interface FormComponentProps {
  fields: FormField[];
  submit_label?: string;
  onSubmit?: (data: Record<string, any>) => void;
  onAction?: (action: string, data: any) => void;
}

export function FormComponent({ fields, submit_label: submitLabel = 'Submit', onSubmit, onAction }: FormComponentProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit?.(formData);
      onAction?.('form_submit', formData);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {fields.map((field) => (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.required}> *</Text>}
          </Text>
          <Input
            value={formData[field.id] || ''}
            onChangeText={(value) => handleChange(field.id, value)}
            placeholder={field.placeholder}
            secureTextEntry={field.type === 'password'}
            keyboardType={
              field.type === 'email' ? 'email-address' :
              field.type === 'number' ? 'numeric' : 'default'
            }
          />
          {errors[field.id] && (
            <Text style={styles.error}>{errors[field.id]}</Text>
          )}
        </View>
      ))}
      <Button title={submitLabel} onPress={handleSubmit} style={styles.submitButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  error: {
    ...typography.caption1,
    color: colors.error,
    marginTop: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
