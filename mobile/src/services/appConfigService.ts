/**
 * App Config Service — fetches and manages app configuration from backend
 */

export interface ModuleInstanceConfig {
  module_instance_id: string;
  module_type: string;
  name: string;
  icon: string;
  slot_position: number | null;
}

export interface AppConfig {
  app_id: string;
  name: string;
  icon: string | null;
  splash: string | null;
  theme: Record<string, any>;
  design_tokens: Record<string, any>;
  dark_mode: boolean;
  default_launch_module_id: string | null;
  bottom_bar_config: ModuleInstanceConfig[];
  launchpad_config: ModuleInstanceConfig[];
}

export class AppConfigService {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async fetchAppConfig(deviceId: string): Promise<AppConfig> {
    const response = await fetch(`${this.baseUrl}/api/devices/${deviceId}/config`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Device not found or no app assigned');
      }
      throw new Error(`Failed to fetch app config: ${response.statusText}`);
    }

    return response.json();
  }
}
