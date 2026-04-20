// NOTE: New API calls should use the generated SDK in src/api/generated/ (run `npm run generate:api`
// while the backend is running to regenerate from http://localhost:8000/openapi.json).
// This manual ApiClient is kept for backward compatibility with existing pages.
const API_BASE = '';  // Uses Vite proxy

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  includeAuth?: boolean;
  suppressUnauthorizedHandler?: boolean;
}

// --- Pagination ---
export interface PaginationParams {
  limit?: number;
  offset?: number;
}
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// --- Variables ---
export interface Variable {
  id: string;
  name: string;
  value: string;
  type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface VariableCreate {
  name: string;
  value: string;
  type: 'text' | 'number' | 'boolean';
  description?: string;
}
export interface VariableUpdate {
  name?: string;
  value?: string;
  type?: 'text' | 'number' | 'boolean';
  description?: string;
}

// --- Workflows ---
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  graph: Record<string, any>;
  trigger_type: string;
  trigger_config: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface WorkflowCreate {
  name: string;
  description?: string;
  graph?: Record<string, any>;
  trigger_type: string;
  trigger_config?: Record<string, any>;
}
export interface WorkflowUpdate {
  name?: string;
  description?: string;
  graph?: Record<string, any>;
  trigger_config?: Record<string, any>;
  enabled?: boolean;
}
export interface WorkflowExecuteResponse {
  execution_id: string;
  status: string;
  result: any;
}
export interface N8nImportResponse {
  workflow: Record<string, any>;
  warnings: string[];
}

// --- Connections ---
export interface Connection {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  created_at: string;
  updated_at: string;
}
export interface ConnectionCreate {
  name: string;
  provider: string;
  credentials: Record<string, unknown>;
}
export interface ConnectionUpdate {
  name?: string;
  credentials?: Record<string, unknown>;
}

// --- Data Sources ---
export interface DataSource {
  id: string;
  name: string;
  type: string;
  connector: string;
  config_json: string;
  schema_json: string | null;
  created_at: string;
  updated_at: string;
}
export interface DataSourceCreate {
  name: string;
  type: string;
  connector: string;
  config_json?: string;
}
export interface DataSourceSchema {
  source_id: string;
  type: string;
  schema: Record<string, unknown> | null;
}
export interface DataSourceQuery {
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}
export interface DataSourceResult {
  source_id: string;
  type: string;
  data: unknown[];
  count: number;
}

// --- Triggers ---
export interface Trigger {
  id: string;
  name: string;
  trigger_type: string;
  config_json: string;
  action_chain_json: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface TriggerCreate {
  name: string;
  trigger_type: 'schedule' | 'data_change' | 'server_event';
  config_json?: string;
  action_chain_json?: string;
  enabled?: boolean;
}
export interface TriggerUpdate {
  name?: string;
  trigger_type?: 'schedule' | 'data_change' | 'server_event';
  config_json?: string;
  action_chain_json?: string;
  enabled?: boolean;
}
export interface TriggerTestResult {
  status: string;
  trigger_id: string;
  result: unknown;
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

  private buildQuery(params?: PaginationParams): string {
    if (!params) return '';
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  // --- Variables ---
  getVariables(params?: PaginationParams) {
    return this.get<PaginatedResponse<Variable>>(`/api/variables${this.buildQuery(params)}`);
  }
  createVariable(data: VariableCreate) {
    return this.post<Variable>('/api/variables', data);
  }
  updateVariable(id: number | string, data: VariableUpdate) {
    return this.put<Variable>(`/api/variables/${id}`, data);
  }
  deleteVariable(id: number | string) {
    return this.del<void>(`/api/variables/${id}`);
  }

  // --- Data Sources ---
  getDataSources(params?: PaginationParams) {
    return this.get<PaginatedResponse<DataSource>>(`/api/data-sources${this.buildQuery(params)}`);
  }
  createDataSource(data: DataSourceCreate) {
    return this.post<DataSource>('/api/data-sources', data);
  }
  deleteDataSource(id: number | string) {
    return this.del<void>(`/api/data-sources/${id}`);
  }
  updateDataSource(id: number | string, data: Partial<DataSourceCreate>) {
    return this.put<DataSource>(`/api/data-sources/${id}`, data);
  }
  getDataSourceSchema(id: number | string) {
    return this.get<DataSourceSchema>(`/api/data-sources/${id}/schema`);
  }
  queryDataSource(id: number | string, params: DataSourceQuery) {
    return this.post<DataSourceResult>(`/api/data-sources/${id}/query`, params);
  }

  // --- Triggers ---
  getTriggers(params?: PaginationParams) {
    return this.get<PaginatedResponse<Trigger>>(`/api/triggers${this.buildQuery(params)}`);
  }
  createTrigger(data: TriggerCreate) {
    return this.post<Trigger>('/api/triggers', data);
  }
  updateTrigger(id: number | string, data: TriggerUpdate) {
    return this.put<Trigger>(`/api/triggers/${id}`, data);
  }
  deleteTrigger(id: number | string) {
    return this.del<void>(`/api/triggers/${id}`);
  }
  testTrigger(id: number | string) {
    return this.post<TriggerTestResult>(`/api/triggers/${id}/test`);
  }

  // --- Connections ---
  getConnections(params?: PaginationParams) {
    return this.get<PaginatedResponse<Connection>>(`/api/connections${this.buildQuery(params)}`);
  }
  createConnection(data: ConnectionCreate) {
    return this.post<Connection>('/api/connections', data);
  }
  updateConnection(id: string, data: ConnectionUpdate) {
    return this.put<Connection>(`/api/connections/${id}`, data);
  }
  deleteConnection(id: string) {
    return this.del<void>(`/api/connections/${id}`);
  }

  // --- Workflows ---
  getWorkflows(params?: PaginationParams) {
    return this.get<PaginatedResponse<Workflow>>(`/api/workflows${this.buildQuery(params)}`);
  }
  getWorkflow(id: string) {
    return this.get<Workflow>(`/api/workflows/${id}`);
  }
  createWorkflow(data: WorkflowCreate) {
    return this.post<Workflow>('/api/workflows', data);
  }
  updateWorkflow(id: string, data: WorkflowUpdate) {
    return this.put<Workflow>(`/api/workflows/${id}`, data);
  }
  deleteWorkflow(id: string) {
    return this.del<void>(`/api/workflows/${id}`);
  }
  executeWorkflow(id: string, input?: Record<string, any>) {
    return this.post<WorkflowExecuteResponse>(`/api/workflows/${id}/execute`, input || {});
  }
  importN8nWorkflow(n8nJson: Record<string, any>) {
    return this.post<N8nImportResponse>('/api/workflows/import/n8n', n8nJson);
  }
}

export const api = new ApiClient();
