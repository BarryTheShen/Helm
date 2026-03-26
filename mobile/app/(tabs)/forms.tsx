import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, Button } from 'react-native';
import { colors, spacing, typography } from '@/theme/colors';

export default function FormsScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comments, setComments] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    console.log('Form submitted:', { name, email, comments });
    Alert.alert('Success', 'Your form has been submitted!');
    setName('');
    setEmail('');
    setComments('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quick Form</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Comments</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any additional information"
        placeholderTextColor={colors.textSecondary}
        value={comments}
        onChangeText={setComments}
        multiline
        numberOfLines={4}
      />

      <View style={styles.buttonContainer}>
        <Button title="Submit" onPress={handleSubmit} color={colors.primary} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.subheadline,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
