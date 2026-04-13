/**
 * WeatherWidget — Example custom component for Keel.
 *
 * Demonstrates how third-party developers can extend Keel
 * with their own components that AI agents can render.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { registerComponent } from '@keel/renderer';

interface WeatherWidgetProps {
  city: string;
  temperature: number;
  unit?: 'C' | 'F';
  condition?: string;
}

function WeatherWidget({ city, temperature, unit = 'F', condition = 'Clear' }: WeatherWidgetProps) {
  const emoji = condition === 'Sunny' ? '☀️' : condition === 'Cloudy' ? '☁️' : condition === 'Rain' ? '🌧️' : '🌤️';

  return React.createElement(View, { style: styles.container },
    React.createElement(Text, { style: styles.emoji }, emoji),
    React.createElement(View, { style: styles.info },
      React.createElement(Text, { style: styles.city }, city),
      React.createElement(Text, { style: styles.temp }, `${temperature}°${unit}`),
      React.createElement(Text, { style: styles.condition }, condition),
    ),
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  emoji: {
    fontSize: 40,
  },
  info: {
    flex: 1,
  },
  city: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  temp: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  condition: {
    fontSize: 14,
    color: '#666',
  },
});

registerComponent('WeatherWidget', WeatherWidget as any);

export { WeatherWidget };
export type { WeatherWidgetProps };
