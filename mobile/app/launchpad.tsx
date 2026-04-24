import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { useAppConfigStore, type ModuleInstanceConfig } from '@/stores/appConfigStore';
import { getRouteForModuleInstance } from '@/constants/moduleRoutes';

export default function LaunchpadScreen() {
  const router = useRouter();
  const appConfig = useAppConfigStore((s) => s.appConfig);

  const launchpadModules = appConfig?.launchpad_config || [];

  const handleModuleTap = (module: ModuleInstanceConfig) => {
    const route = getRouteForModuleInstance({
      module_type: module.module_type,
      template_id: null, // Launchpad modules don't have template_id in the current interface
    });
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Launchpad</Text>
        <Text style={styles.subtitle}>All your modules in one place</Text>
      </View>

      <FlatList
        data={launchpadModules}
        keyExtractor={(item) => item.module_instance_id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.moduleCard}
            onPress={() => handleModuleTap(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.moduleName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🧩</Text>
            <Text style={styles.emptyText}>No modules in launchpad</Text>
            <Text style={styles.emptySubtext}>
              All your modules are in the bottom bar
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  grid: {
    padding: 16,
  },
  moduleCard: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 120,
    maxWidth: '30%',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 28,
  },
  moduleName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
