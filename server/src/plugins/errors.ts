import type { ApiError, ErrorCode } from '@omp/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

export function apiError(code: ErrorCode, message: string): ApiError {
  return { code, message };
}

/** Sends `ApiError` with a status, and returns the reply so hooks stop. */
export function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
): FastifyReply {
  return reply.code(status).send(apiError(code, message));
}

/** Words for a validation problem, without echoing the value the caller sent. */
export function describeValidation(
  issues: { instancePath: string; message?: string | undefined }[],
): string {
  const first = issues[0];
  if (!first) return 'The request is not valid';
  const field = first.instancePath.replace(/^\//, '').replaceAll('/', '.');
  return field
    ? `${field}: ${first.message ?? 'invalid'}`
    : (first.message ?? 'invalid');
}

/** Every error leaves the server as `ApiError`. Request bodies are never logged. */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return sendError(
      reply,
      400,
      'validation_failed',
      describeValidation(error.validation),
    );
  }
  if (error.statusCode === 429) {
    return sendError(
      reply,
      429,
      'too_many_attempts',
      'Too many attempts. Wait a few minutes and try again.',
    );
  }
  if (isResponseSerializationError(error)) {
    request.log.error(
      {
        issues: error.cause.issues.map((i) => ({ path: i.path, code: i.code })),
      },
      'response did not match its schema',
    );
    return sendError(reply, 500, 'internal_error', 'Something went wrong');
  }
  if (error.statusCode !== undefined && error.statusCode < 500) {
    return sendError(
      reply,
      error.statusCode,
      error.statusCode === 404 ? 'not_found' : 'validation_failed',
      error.statusCode === 404 ? 'Not found' : 'The request is not valid',
    );
  }
  request.log.error(
    { err: { message: error.message, code: error.code } },
    'request failed',
  );
  return sendError(reply, 500, 'internal_error', 'Something went wrong');
}
