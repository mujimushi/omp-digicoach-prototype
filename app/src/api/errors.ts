import type { ErrorCode } from '@omp/shared';

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
