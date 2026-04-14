/**
 * @keel/protocol — SDUI V2 types, action types, and validation schemas
 *
 * This package provides the type definitions and validation schemas
 * for the Keel Server-Driven UI protocol. It has zero runtime dependencies
 * beyond Zod (peer dependency for schemas).
 *
 * @example
 * ```ts
 * import type { SDUIPage, SDUIAction, SDUIComponent } from '@keel/protocol';
 * import { sduiPageSchema, wsMessageSchema } from '@keel/protocol';
 * ```
 */

// SDUI V2 types
export type {
  SDUIAction,
  SDUIComponentType,
  SDUIComponent,
  SDUICell,
  SDUIRow,
  SDUIPage,
  ActionDispatcher,
  SDUIFormField,
  SDUIScreenOptions,
  SDUIComponentUpdate,
} from './types/sdui';

export { isSDUIPage } from './types/sdui';

// Validation schemas
export {
  sduiComponentSchema,
  sduiCellSchema,
  sduiRowSchema,
  sduiPageSchema,
  wsMessageSchema,
  calendarPropsSchema,
  formPropsSchema,
  safeUrlSchema,
  formSubmitSchema,
  screenOptionsSchema,
  selectScreenSchema,
  componentUpdateSchema,
} from './schemas/validation';
