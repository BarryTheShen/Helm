// Server-Driven UI types

export type SDUIComponentType =
  | 'calendar'
  | 'form'
  | 'alert'
  | 'list'
  | 'card'
  | 'chart'
  | 'map'
  | 'text'
  | 'image'
  | 'button';

export interface SDUIComponent {
  type: SDUIComponentType;
  id: string;
  props: Record<string, any>;
  children?: SDUIComponent[];
}

export interface CalendarProps {
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color?: string;
  }>;
  view: 'month' | 'day';
  onEventPress?: (eventId: string) => void;
}

export interface FormProps {
  fields: Array<{
    id: string;
    type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox';
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
  submitLabel: string;
  onSubmit?: (data: Record<string, any>) => void;
}

export interface AlertProps {
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export interface ListProps {
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    onPress?: () => void;
  }>;
}
