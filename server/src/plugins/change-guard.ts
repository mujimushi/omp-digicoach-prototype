import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendError } from './errors.ts';

const CHANGE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_TYPE = /^application\/json\s*(;|$)/i;

function sameOrigin(origin: string, request: FastifyRequest): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const appOrigin = request.server.config.appOrigin;
  if (appOrigin) return parsed.origin === new URL(appOrigin).origin;
  return parsed.host === request.host;
}

/**
 * Cross-site request forgery guard (OWASP, custom request headers): every change request must send
 * `X-OMP-Client: app` and a JSON body type, and any `Origin` header must be this app's own.
 */
export async function changeRequestGuard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!CHANGE_METHODS.has(request.method)) return;
  const origin = request.headers.origin;
  if (
    request.headers['x-omp-client'] !== 'app' ||
    !JSON_TYPE.test(request.headers['content-type'] ?? '') ||
    (origin !== undefined && !sameOrigin(origin, request))
  ) {
    return sendError(
      reply,
      403,
      'forbidden',
      'This change must come from the app',
    );
  }
}
