import { View, Text, StyleSheet } from 'react-native';
import type { SDUIComponent } from '@/types/sdui';
import { CalendarComponent } from './CalendarComponent';
import { FormComponent } from './FormComponent';
import { AlertComponent } from './AlertComponent';
import { ListComponent } from './ListComponent';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { colors, spacing, typography } from '@/theme/colors';

interface SDUIRendererProps {
  component: SDUIComponent;
  onAction?: (action: string, data: any) => void;
}

export function SDUIRenderer({ component, onAction }: SDUIRendererProps) {
  const renderComponent = (comp: SDUIComponent): JSX.Element | null => {
    switch (comp.type) {
      case 'calendar':
        return <CalendarComponent {...comp.props} onAction={onAction} />;

      case 'form':
        return <FormComponent {...comp.props} onAction={onAction} />;

      case 'alert':
        return <AlertComponent {...comp.props} onAction={onAction} />;

      case 'list':
        return <ListComponent {...comp.props} onAction={onAction} />;

      case 'card':
        return (
          <Card style={styles.card}>
            {comp.children?.map((child) => (
              <View key={child.id}>{renderComponent(child)}</View>
            ))}
          </Card>
        );

      case 'text':
        return (
          <Text style={[styles.text, comp.props.style]}>
            {comp.props.content}
          </Text>
        );

      case 'button':
        return (
          <Button
            title={comp.props.label}
            onPress={() => onAction?.(comp.props.action, comp.props.data)}
            disabled={comp.props.disabled}
          />
        );

      case 'image':
        // Image component would go here
        return null;

      case 'chart':
        // Chart component would go here
        return null;

      case 'map':
        // Map component would go here
        return null;

      default:
        return (
          <View style={styles.unknownComponent}>
            <Text style={styles.unknownText}>
              Unknown component: {comp.type}
            </Text>
          </View>
        );
    }
  };

  return <View style={styles.container}>{renderComponent(component)}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  unknownComponent: {
    padding: spacing.md,
    backgroundColor: colors.error + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  unknownText: {
    ...typography.body,
    color: colors.error,
  },
});
