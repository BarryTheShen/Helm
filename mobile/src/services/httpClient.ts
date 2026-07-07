export interface HttpRequestInit extends RequestInit {
  includeAuthorization?: boolean;
  includeContentType?: boolean;
}

export type UnauthorizedHandler = () => void | Promise<void>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readErrorDetail(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const detail = value.detail;
  return typeof detail === 'string' ? detail : undefined;
}

function mergeHeaders(
  headers: HeadersInit | undefined,
  token: string | null,
  includeAuthorization: boolean,
  includeContentType: boolean,
): Headers {
  const merged = new Headers();

  if (includeContentType) {
    merged.set('Content-Type', 'application/json');
  }

  if (includeAuthorization && token) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  new Headers(headers).forEach((value, key) => {
    merged.set(key, value);
  });

  return merged;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null = null,
    private readonly onUnauthorized: UnauthorizedHandler | null = null,
  ) {}

  async request(path: string, options: HttpRequestInit = {}): Promise<Response> {
    const {
      includeAuthorization = true,
      includeContentType = true,
      headers,
      ...requestInit
    } = options;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestInit,
      headers: mergeHeaders(headers, this.token, includeAuthorization, includeContentType),
    });

    if (response.status === 401 && this.onUnauthorized) {
      void this.onUnauthorized();
    }

    return response;
  }
}
