import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.ts';
import type { Db } from '../db/client.ts';
import {
  DASHBOARD_LOGIN_MAX_MS,
  deleteUserSessions,
  findLoginSession,
  type UserRow,
} from '../services/auth/sessions.ts';
import { sendError } from './errors.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Db;
    /** The server's clock. Tests replace it. */
    now: () => Date;
  }
  interface FastifyRequest {
    /** The logged-in user, or null. Never sent as-is: it holds the password hash. */
    user: UserRow | null;
    loginSessionId: string | null;
    /** When the password was typed for this login. */
    loginStartedAt: Date | null;
    /** Why a cookie didn't log anyone in. */
    authProblem: 'expired' | 'switched_off' | null;
  }
}

export function cookieOptions(config: Config) {
  return {
    path: '/',
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'strict' as const,
  };
}

export function clearLoginCookie(reply: FastifyReply, config: Config) {
  reply.clearCookie(config.cookie.name, cookieOptions(config));
}

/** Sets `request.user` from the login cookie on every /api request. */
export function registerAuth(api: FastifyInstance) {
  api.decorateRequest('user');
  api.decorateRequest('loginSessionId');
  api.decorateRequest('loginStartedAt');
  api.decorateRequest('authProblem');

  api.addHook('onRequest', async (request, reply) => {
    request.user = null;
    request.loginSessionId = null;
    request.loginStartedAt = null;
    request.authProblem = null;

    const token = request.cookies[api.config.cookie.name];
    if (!token) return;

    const found = await findLoginSession(api.db, token, api.now());
    if (!found) {
      request.authProblem = 'expired';
      return;
    }
    if ('endedReason' in found) {
      request.authProblem = 'switched_off';
      return;
    }
    if (!found.user.active) {
      await deleteUserSessions(api.db, found.user.id);
      request.authProblem = 'switched_off';
      return;
    }
    request.user = found.user;
    request.loginSessionId = found.id;
    request.loginStartedAt = found.createdAt;
    // The login moved forward, so the phone's cookie does too. Login, logout and password change
    // set their own cookie later in the request, which replaces this one.
    if (found.renewedMaxAgeSeconds !== null) {
      reply.setCookie(api.config.cookie.name, token, {
        ...cookieOptions(api.config),
        maxAge: found.renewedMaxAgeSeconds,
      });
    }
  });
}

function notLoggedIn(request: FastifyRequest, reply: FastifyReply) {
  if (request.authProblem !== null) {
    clearLoginCookie(reply, request.server.config);
  }
  return sendError(
    reply,
    401,
    'not_logged_in',
    request.authProblem === 'switched_off'
      ? 'This account has been switched off. Ask the admin.'
      : 'Please log in.',
  );
}

/** Any active user, even one who must still change their password. */
export async function requireLogin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) return notLoggedIn(request, reply);
}

/** A doctor whose password is already changed. */
export async function requireDoctor(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user;
  if (!user) return notLoggedIn(request, reply);
  if (user.mustChangePassword) {
    return sendError(
      reply,
      403,
      'password_change_required',
      'Choose a new password first.',
    );
  }
  if (!user.isDoctor) {
    return sendError(reply, 403, 'forbidden', 'This is for doctors.');
  }
}

/** An admin whose password is already changed, typed within the last 8 hours. */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user;
  if (!user) return notLoggedIn(request, reply);
  const startedAt = request.loginStartedAt?.getTime() ?? 0;
  if (
    user.isAdmin &&
    request.server.now().getTime() - startedAt >= DASHBOARD_LOGIN_MAX_MS
  ) {
    // The login still works in the doctor's app; only the dashboard asks for the password again.
    return sendError(
      reply,
      401,
      'not_logged_in',
      'Log in again to open the dashboard.',
    );
  }
  if (user.mustChangePassword) {
    return sendError(
      reply,
      403,
      'password_change_required',
      'Choose a new password first.',
    );
  }
  if (!user.isAdmin) {
    return sendError(reply, 403, 'forbidden', 'This page is for the admin.');
  }
}
