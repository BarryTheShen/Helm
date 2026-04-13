/**
 * Keel Demo App — Runnable Expo prototype.
 *
 * Demonstrates using the Paper preset for Material Design 3 styling.
 * All SDUI atomic components render with react-native-paper under the hood.
 *
 * Run: cd examples/keel-demo && npm install && npx expo start
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider, SegmentedButtons } from 'react-native-paper';
import { SDUIPageRenderer, registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

// Register custom components before any render
import './WeatherWidget';

// Apply Paper preset — all atomic components now use Material Design 3
registerPreset(PaperPreset);

// Demo data
import { homeScreen, calendarScreen } from './screens';
import type { SDUIAction } from '@keel/protocol';

/** Action dispatcher — shows alerts for demo purposes */
function handleAction(action: SDUIAction): void {
  switch (action.type) {
    case 'navigate':
      Alert.alert('Navigate', `Screen: ${action.screen}`);
      break;
    case 'go_back':
      Alert.alert('Navigation', 'Go back');
      break;
    case 'open_url':
      Alert.alert('Open URL', action.url);
      break;
    case 'copy_text':
      Alert.alert('Copied', action.text);
      break;
    case 'send_to_agent':
      Alert.alert('Agent Message', action.message || '(empty)');
      break;
    case 'server_action':
      Alert.alert('Server Action', `${action.function}(${JSON.stringify(action.params)})`);
      break;
    case 'api_call':
      Alert.alert('API Call', `${action.method} ${action.path}`);
      break;
    case 'dismiss':
      Alert.alert('Dismiss', 'Sheet dismissed');
      break;
    default:
      Alert.alert('Action', JSON.stringify(action));
  }
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const currentScreen = screen === 'home' ? homeScreen : calendarScreen;

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.tabBar}>
            <SegmentedButtons
              value={screen}
              onValueChange={setScreen}
              buttons={[
                { value: 'home', label: 'Home' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <SDUIPageRenderer page={currentScreen} onAction={handleAction} />
          </ScrollView>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
});
