import { ApiError, type ErrorCode } from '@omp/shared';
import type { z } from 'zod';

/** The server answered with an error. */
export class ApiRequestError extends Error {
  override name = 'ApiRequestError';
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The request never got an answer: no signal, or the server is down. */
export class NetworkError extends Error {
  override name = 'NetworkError';
}

type RequestOptions = {
  /** Sync keeps the doctor where they are on a 401; everything else goes to /login. */
  redirectOnUnauthorized?: boolean;
  signal?: AbortSignal;
};

let onUnauthorized: () => void = () => {
  window.location.assign('/login');
};

/** The auth provider replaces the default, full-page redirect with a router navigation. */
export function setUnauthorizedHandler(handler: () => void): () => void {
  const previous = onUnauthorized;
  onUnauthorized = handler;
  return () => {
    onUnauthorized = previous;
  };
}

/** Resolved against the page's address, so tests in Node can use the same paths. */
function url(path: string): string {
  return new URL(path, window.location.origin).toString();
}

async function readError(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = ApiError.safeParse(body);
  if (parsed.success) {
    return new ApiRequestError(
      response.status,
      parsed.data.code,
      parsed.data.message,
    );
  }
  return new ApiRequestError(
    response.status,
    response.status >= 500 ? 'internal_error' : 'validation_failed',
    `The server answered ${response.status}`,
  );
}

async function request(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<Response> {
  const changes = method !== 'GET';
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: changes
      ? {
          'content-type': 'application/json',
          'x-omp-client': 'app',
          accept: 'application/json',
        }
      : { accept: 'application/json' },
  };
  // Every change sends a JSON body, even an empty one, so the server's guard sees JSON.
  if (changes) init.body = JSON.stringify(body ?? {});
  if (options.signal) init.signal = options.signal;

  let response: Response;
  try {
    response = await fetch(url(path), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new NetworkError('No connection to the server');
  }

  if (!response.ok) {
    const error = await readError(response);
    if (response.status === 401 && (options.redirectOnUnauthorized ?? true)) {
      onUnauthorized();
    }
    throw error;
  }
  return response;
}

/** GET a JSON answer and check it against its schema. */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const response = await request('GET', path, undefined, options);
  return schema.parse(await response.json());
}

/** POST, PATCH or DELETE with the app headers. Pass a schema when the route answers JSON. */
export async function apiSend<T extends z.ZodType>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  schema: T,
  options?: RequestOptions,
): Promise<z.infer<T>>;
export async function apiSend(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  schema?: undefined,
  options?: RequestOptions,
): Promise<undefined>;
export async function apiSend(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  schema?: z.ZodType,
  options: RequestOptions = {},
): Promise<unknown> {
  const response = await request(method, path, body, options);
  if (!schema) return undefined;
  return schema.parse(await response.json());
}

/** GET a file, such as the CSV export. */
export async function apiGetBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const response = await request('GET', path, undefined, options);
  return response.blob();
}
