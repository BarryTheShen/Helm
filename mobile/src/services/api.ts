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
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<CalendarEvent[]>(`/api/calendar/events${query}`);
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
    return this.request<Notification[]>('/api/notifications');
  }

  async deleteNotification(id: string): Promise<void> {
    return this.request<void>(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  // Agent config
  async getAgentConfig(): Promise<AgentConfig> {
    return this.request<AgentConfig>('/api/agent');
  }

  async updateAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
    return this.request<AgentConfig>('/api/agent', {
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
  async getModules(): Promise<Module[]> {
    return this.request<Module[]>('/api/modules');
  }

  // Chat history
  async getChatHistory(conversationId?: string): Promise<ChatMessage[]> {
    const query = conversationId ? `?conversation_id=${conversationId}` : '';
    return this.request<ChatMessage[]>(`/api/chat${query}`);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.request<void>(`/api/chat/${conversationId}`, { method: 'DELETE' });
  }
}
