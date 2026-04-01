import type { SetupRequest, SetupResponse, LoginRequest, LoginResponse } from '@/types/api';

export class AuthService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async setup(data: SetupRequest): Promise<SetupResponse> {
    const response = await fetch(`${this.baseUrl}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Setup failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  }

  async logout(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.statusText}`);
    }
  }
}
