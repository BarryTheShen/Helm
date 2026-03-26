import { z } from 'zod';

// SDUI validation schemas
export const sduiComponentSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.enum(['calendar', 'form', 'alert', 'list', 'card', 'chart', 'map', 'text', 'image', 'button']),
    id: z.string(),
    props: z.record(z.any()),
    children: z.array(sduiComponentSchema).optional(),
  })
);

export const calendarPropsSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      allDay: z.boolean(),
      color: z.string().optional(),
    })
  ),
  view: z.enum(['month', 'day']),
  onEventPress: z.function().optional(),
});

export const formPropsSchema = z.object({
  fields: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['text', 'email', 'password', 'number', 'date', 'select', 'checkbox']),
      label: z.string(),
      placeholder: z.string().optional(),
      required: z.boolean().optional(),
      options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    })
  ),
  submitLabel: z.string(),
  onSubmit: z.function().optional(),
});

export const alertPropsSchema = z.object({
  severity: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string(),
  message: z.string(),
  dismissible: z.boolean().optional(),
  onDismiss: z.function().optional(),
});

// WebSocket message validation
// .passthrough() preserves extra fields (token, message_id, message, content, etc.)
// that the backend sends alongside 'type'. Without it, Zod strips them.
export const wsMessageSchema = z.object({
  type: z.string(),
  data: z.any().optional(),
  timestamp: z.string().optional(),
}).passthrough();
