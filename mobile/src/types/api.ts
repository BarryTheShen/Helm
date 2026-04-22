// Backend API types

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: string;
}

export interface SetupRequest {
  username: string;
  password: string;
}

export interface SetupResponse {
  user_id: string;
  message: string;
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

export interface RefreshResponse {
  session_token: string;
  token_type: string;
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

export interface AgentConfig {
  id: string;
  user_id: string;
  model_name: string;
  system_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  trigger_type: 'event' | 'scheduled';
  trigger_config: string;
  action_type: string;
  action_config: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  pinned: boolean;
  tab_order: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface TemplateDetail extends Template {
  screen_json: Record<string, any>;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: string;
  last_seen: string;
}

export interface Settings {
  id: string;
  user_id: string;
  display_name?: string;
  email?: string;
  endpoint_url?: string;
  dark_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingsUpdate {
  display_name?: string;
  email?: string;
  endpoint_url?: string;
  dark_mode?: boolean;
  password?: string;
}
