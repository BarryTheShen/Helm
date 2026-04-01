import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthService } from '@/services/auth';
import { colors, spacing, typography } from '@/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { serverUrl, setToken, setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    if (!serverUrl) {
      setError('Server URL not configured');
      router.replace('/(auth)/connect');
      return;
    }

    setIsLoading(true);
    try {
      const authService = new AuthService(serverUrl);
      const response = await authService.login({
        username,
        password,
        device_id: 'web',
        device_name: 'Web Browser',
      });

      await setToken(response.session_token);
      await setUser({ id: response.user_id, username: response.username, email: '', created_at: '' });
      router.replace('/(tabs)/chat');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect username or password');
      } else if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
        setError('Cannot reach server. Check your connection and server URL.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Enter your credentials to continue</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={isLoading ? undefined : handleLogin}
          disabled={isLoading}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Connected to: {serverUrl}</Text>
          <Text
            style={styles.link}
            onPress={() => router.replace('/(auth)/connect')}
          >
            Change Server
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.subheadline,
    color: '#DC2626',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.subheadline,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.headline,
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  link: {
    ...typography.footnote,
    color: colors.primary,
  },
});
