import type {
  LoginRequest,
  LoginResponse,
  CalendarEvent,
  Notification,
  AgentConfig,
  Workflow,
  Module,
  ChatMessage,
} from '@/types/api';
import type { SDUIDraftResponse, SDUIScreenResponse } from '@/types/sdui';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private onUnauthorized: () => void;

  constructor(baseUrl: string, token: string | null, onUnauthorized: () => void) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.onUnauthorized = onUnauthorized;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers as Record<string, string> || {}) },
    });

    if (response.status === 401) {
      this.onUnauthorized();
      throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(error.detail || response.statusText, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth
  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    return this.request<void>('/auth/logout', { method: 'POST' });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  // Calendar
  async getCalendarEvents(start?: string, end?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (start) params.append('start_date', start);
    if (end) params.append('end_date', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{events: CalendarEvent[]}>(`/api/calendar/events${query}`);
    return res.events;
  }

  async createCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.request<CalendarEvent>('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateCalendarEvent(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(`/api/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    return this.request<void>(`/api/calendar/events/${id}`, { method: 'DELETE' });
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await this.request<{notifications: Notification[], unread_count: number}>('/api/notifications');
    return res.notifications;
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  // Agent config
  async getAgentConfig(): Promise<AgentConfig> {
    return this.request<AgentConfig>('/api/agent/config');
  }

  async updateAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
    return this.request<AgentConfig>('/api/agent/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Workflows
  async getWorkflows(): Promise<Workflow[]> {
    return this.request<Workflow[]>('/api/workflows');
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.request<void>(`/api/workflows/${id}`, { method: 'DELETE' });
  }

  // Modules
  async getModules(): Promise<{ modules: Module[] }> {
    return this.request<{ modules: Module[] }>('/api/modules');
  }

  async hideTab(tabId: string): Promise<void> {
    return this.request<void>(`/api/modules/${tabId}`, { method: 'DELETE' });
  }

  async showTab(tabId: string): Promise<void> {
    return this.request<void>(`/api/modules/${tabId}/show`, { method: 'POST' });
  }

  async configureModule(tabId: string, config: { name?: string; icon?: string }): Promise<void> {
    return this.request<void>(`/api/modules/${tabId}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  // SDUI
  async getSDUIScreen(moduleId: string): Promise<SDUIScreenResponse> {
    return this.request<SDUIScreenResponse>(`/api/sdui/${moduleId}`);
  }

  async getSDUIDraft(moduleId: string): Promise<SDUIDraftResponse> {
    return this.request<SDUIDraftResponse>(`/api/sdui/${moduleId}/draft`);
  }

  async deleteSDUIScreen(moduleId: string): Promise<void> {
    return this.request<void>(`/api/sdui/${moduleId}`, { method: 'DELETE' });
  }

  // Chat history
  async getChatHistory(conversationId?: string): Promise<ChatMessage[]> {
    const query = conversationId ? `?conversation_id=${conversationId}` : '';
    const res = await this.request<{messages: ChatMessage[], has_more: boolean}>(`/api/chat/history${query}`);
    return res.messages;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.request<void>(`/api/chat/history`, { method: 'DELETE' });
  }

  // Server actions (SDUI function registry)
  async executeAction(functionName: string, params: Record<string, any> = {}): Promise<any> {
    return this.request<any>('/api/actions/execute', {
      method: 'POST',
      body: JSON.stringify({ function: functionName, params }),
    });
  }
}
