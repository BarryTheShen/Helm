import type { LoginRequest, LoginResponse } from '@/types/api';
import { HttpClient, readErrorDetail } from '@/services/httpClient';

export class AuthService {
  private http: HttpClient;

  constructor(baseUrl: string) {
    this.http = new HttpClient(baseUrl);
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.http.request('/auth/login', {
      method: 'POST',
      includeAuthorization: false,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const detail = readErrorDetail(error);
      throw new Error(detail || 'Login failed');
    }

    return response.json();
  }

  async logout(token: string): Promise<void> {
    const response = await this.http.request('/auth/logout', {
      method: 'POST',
      includeAuthorization: false,
      includeContentType: false,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.statusText}`);
    }
  }
}
