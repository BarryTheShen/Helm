const API_BASE = '';  // Uses Vite proxy

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  includeAuth?: boolean;
  suppressUnauthorizedHandler?: boolean;
}

class ApiClient {
  private token: string | null = null;
  private unauthorizedHandler: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.unauthorizedHandler = handler;
  }

  async request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.includeAuth !== false && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401 && !options.suppressUnauthorizedHandler) {
        this.unauthorizedHandler?.();
      }

      const error = await response.json().catch(() => null);
      const detail = error && typeof error === 'object' && 'detail' in error
        ? (error as { detail?: unknown }).detail
        : error;

      throw new Error(typeof detail === 'string' ? detail : response.statusText || `HTTP ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  get<T>(path: string, options?: Omit<ApiOptions, 'method' | 'body'>) {
    return this.request<T>(path, options);
  }

  post<T>(path: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  del<T>(path: string, options?: Omit<ApiOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
