/**
 * Keel Protocol — Common API response types
 *
 * These types describe the shape of data returned by a Keel-compatible backend.
 * They are framework-agnostic and can be used by any client.
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  device_id: string;
  device_name: string;
}

export interface LoginResponse {
  session_token: string;
  expires_at: string;
  user_id: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata_json?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  actions: Array<Record<string, unknown>> | null;
  created_at: string;
}

export interface Module {
  id: string;
  name: string;
  icon: string;
  route: string;
  description?: string;
  enabled?: boolean;
}
