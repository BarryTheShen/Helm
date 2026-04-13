/**
 * Keel Protocol — Zod validation schemas
 *
 * Reusable schemas for validating SDUI components and WebSocket messages.
 */

import { z } from 'zod';

/** Safe URL schema — only allows http/https (and optionally mailto/tel) */
export const safeUrlSchema = z.string().refine(
  (url) => /^(https?|mailto|tel):\/?\/?/i.test(url),
  { message: 'Only http, https, mailto, and tel URLs are allowed' }
);

/** Validates a single SDUI component (recursive for children) */
export const sduiComponentSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.string().min(1),
    id: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(sduiComponentSchema).optional(),
  })
);

/** Validates an SDUI cell within a row */
export const sduiCellSchema = z.object({
  id: z.string(),
  width: z.union([z.number(), z.literal('auto')]).optional(),
  content: sduiComponentSchema,
});

/** Validates an SDUI row */
export const sduiRowSchema = z.object({
  id: z.string(),
  cells: z.array(sduiCellSchema),
  compact: z.object({
    hidden: z.boolean().optional(),
    stack: z.boolean().optional(),
    direction: z.string().optional(),
    gap: z.number().optional(),
  }).optional(),
  regular: z.object({
    hidden: z.boolean().optional(),
    direction: z.string().optional(),
    gap: z.number().optional(),
  }).optional(),
  scrollable: z.boolean().optional(),
  backgroundColor: z.string().optional(),
  padding: z.union([z.number(), z.string()]).optional(),
  gap: z.number().optional(),
});

/** Validates a complete SDUI V2 page */
export const sduiPageSchema = z.object({
  schema_version: z.literal('1.0.0'),
  module_id: z.string(),
  title: z.string().optional(),
  rows: z.array(sduiRowSchema),
  generated_at: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * WebSocket message validation.
 * .passthrough() preserves extra fields (token, message_id, content, etc.)
 * that the server sends alongside 'type'. Without it, Zod strips them.
 */
export const wsMessageSchema = z.object({
  type: z.string(),
  data: z.any().optional(),
  timestamp: z.string().optional(),
}).passthrough();

/** Validates a calendar event props payload */
export const calendarPropsSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
    })
  ),
  view: z.enum(['month', 'day']).optional(),
});

/** Validates a form_submit action payload */
export const formSubmitSchema = z.object({
  type: z.literal('form_submit'),
  form_id: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

/** Validates a set of screen options presented by the AI */
export const screenOptionsSchema = z.object({
  prompt: z.string(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    screen: sduiPageSchema,
  })).min(1),
});

/** Validates a select_screen action payload */
export const selectScreenSchema = z.object({
  type: z.literal('select_screen'),
  option_id: z.string().min(1),
});

/** Validates a partial component update payload */
export const componentUpdateSchema = z.object({
  component_id: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
});

/** Validates a form field definition */
export const formPropsSchema = z.object({
  fields: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['text', 'email', 'password', 'number', 'date', 'select', 'checkbox', 'textarea']),
      label: z.string(),
      placeholder: z.string().optional(),
      required: z.boolean().optional(),
      options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    })
  ),
  submitLabel: z.string().optional(),
});
