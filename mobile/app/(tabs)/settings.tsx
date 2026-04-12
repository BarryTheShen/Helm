import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { colors, spacing, typography } from '@/theme/colors';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { AuthService } from '@/services/auth';

export default function SettingsScreen() {
  const handleAction = useActionDispatcher();
  const router = useRouter();
  const { user, token, serverUrl, logout } = useAuthStore();
  const { screen: sduiScreen } = useSDUIScreen('settings');

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          // Invalidate session on the server first
          if (serverUrl && token) {
            try {
              const authService = new AuthService(serverUrl);
              await authService.logout(token);
            } catch {
              // Server logout failed — still clear local state
            }
          }
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // If the AI has set an SDUI screen for the settings tab, render that instead
  if (sduiScreen) {
    return <SDUIUniversalRenderer payload={sduiScreen} onAction={handleAction} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Server Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          <Card>
            <Text style={styles.label}>Server URL</Text>
            <Text style={styles.value}>{serverUrl || 'Not configured'}</Text>
          </Card>
        </View>

        {/* Agent Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent</Text>
          <Card>
            <Text style={styles.label}>Model</Text>
            <Text style={styles.value}>Configure in backend</Text>
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>1.0.0</Text>
          </Card>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value}>{user?.username || 'Not logged in'}</Text>
            {user?.email ? (
              <>
                <Text style={[styles.label, styles.labelSpacing]}>Email</Text>
                <Text style={styles.value}>{user.email}</Text>
              </>
            ) : null}
          </Card>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="outline"
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelSpacing: {
    marginTop: spacing.md,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
});
