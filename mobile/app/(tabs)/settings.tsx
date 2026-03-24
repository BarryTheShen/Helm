import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { colors, spacing, typography } from '@/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, serverUrl, logout } = useAuthStore();
  const { navigationMode, theme, setNavigationMode, setTheme } = useSettingsStore();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/connect');
        },
      },
    ]);
  };

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

        {/* Navigation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          <Card>
            <Text style={styles.label}>Mode</Text>
            <Text style={styles.value}>
              {navigationMode === 'tabs' ? 'Bottom Tabs' : 'Drawer'}
            </Text>
          </Card>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Card>
            <Text style={styles.label}>Theme</Text>
            <Text style={styles.value}>
              {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
            </Text>
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
            {user?.email && (
              <>
                <Text style={[styles.label, styles.labelSpacing]}>Email</Text>
                <Text style={styles.value}>{user.email}</Text>
              </>
            )}
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
