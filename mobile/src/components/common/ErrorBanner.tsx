import { View, Text } from 'react-native';
import { Button } from './Button';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <View className="bg-red-500 p-4 rounded-lg mx-4 my-2">
      <Text className="text-white text-base font-normal leading-snug mb-2">{message}</Text>
      <View className="flex-row gap-2">
        {onRetry && (
          <Button title="Retry" onPress={onRetry} variant="outline" style={{ flex: 1, borderColor: '#FFFFFF' }} />
        )}
        {onDismiss && (
          <Button title="Dismiss" onPress={onDismiss} variant="outline" style={{ flex: 1, borderColor: '#FFFFFF' }} />
        )}
      </View>
    </View>
  );
}
