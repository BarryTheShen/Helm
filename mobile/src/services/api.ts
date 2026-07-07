import type {
  LoginRequest,
  LoginResponse,
  CalendarEvent,
  Notification,
  Module,
  ChatMessage,
  Template,
  TemplateDetail,
} from '@/types/api';
import type { SDUIDraftResponse, SDUIScreenResponse } from '@/types/sdui';
import { HttpClient, readErrorDetail } from '@/services/httpClient';

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
  private http: HttpClient;

  constructor(baseUrl: string, token: string | null, onUnauthorized: () => void) {
    this.http = new HttpClient(baseUrl, token, onUnauthorized);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await this.http.request(path, options);

    if (response.status === 401) {
      throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
      const rawError: unknown = await response.json().catch(() => null);
      const detail = readErrorDetail(rawError) ?? response.statusText;
      throw new ApiError(detail || response.statusText, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const body: unknown = await response.json();
    return body as T;
  }

  // Auth
  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Calendar
  async getCalendarEvents(start?: string, end?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (start) params.append('start_date', start);
    if (end) params.append('end_date', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ events: CalendarEvent[] }>(`/api/calendar/events${query}`);
    return res.events;
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await this.request<{ notifications: Notification[]; unread_count: number }>('/api/notifications');
    return res.notifications;
  }

  // Modules
  async getModules(): Promise<{ modules: Module[] }> {
    return this.request<{ modules: Module[] }>('/api/modules');
  }

  // SDUI
  async getSDUIScreen(moduleId: string): Promise<SDUIScreenResponse> {
    return this.request<SDUIScreenResponse>(`/api/sdui/${moduleId}`);
  }

  async getSDUIDraft(moduleId: string): Promise<SDUIDraftResponse> {
    return this.request<SDUIDraftResponse>(`/api/sdui/${moduleId}/draft`);
  }

  // Chat history
  async getChatHistory(conversationId?: string): Promise<ChatMessage[]> {
    const query = conversationId ? `?conversation_id=${conversationId}` : '';
    const res = await this.request<{ messages: ChatMessage[]; has_more: boolean }>(`/api/chat/history${query}`);
    return res.messages;
  }

  async deleteConversation(_conversationId: string): Promise<void> {
    return this.request<void>(`/api/chat/history`, { method: 'DELETE' });
  }

  // Server actions (SDUI function registry)
  async executeAction(functionName: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request<unknown>('/api/actions/execute', {
      method: 'POST',
      body: JSON.stringify({ function: functionName, params }),
    });
  }

  // Templates
  async getTemplates(category?: string, search?: string): Promise<{ items: Template[]; total: number; page: number; page_size: number }> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ items: Template[]; total: number; page: number; page_size: number }>(`/api/templates${query}`);
  }

  async getTemplateDetail(templateId: string): Promise<TemplateDetail> {
    return this.request<TemplateDetail>(`/api/templates/${templateId}`);
  }

  async applyTemplate(templateId: string, moduleId: string): Promise<void> {
    return this.request<void>(`/api/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ module_id: moduleId }),
    });
  }

  // Preview mode
  async exitPreview(deviceId: string): Promise<void> {
    return this.request<void>(`/api/devices/${deviceId}/exit-preview`, {
      method: 'POST',
    });
  }
}
