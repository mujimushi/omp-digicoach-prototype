import { LoginRequest, PublicUser } from '@omp/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { users } from '../../db/schema.ts';
import { clearLoginCookie, cookieOptions } from '../../plugins/auth.ts';
import { sendError } from '../../plugins/errors.ts';
import {
  clearFailures,
  lockedUntil,
  recordFailure,
} from '../../services/auth/attempts.ts';
import { getDummyHash, passwordHasher } from '../../services/auth/passwords.ts';
import {
  createLoginSession,
  deleteLoginSession,
} from '../../services/auth/sessions.ts';
import { findUserByUsername, toPublicUser } from '../../services/auth/users.ts';

const INVALID = 'Wrong username or password';

export async function authRoutes(api: FastifyInstance) {
  const routes = api.withTypeProvider<ZodTypeProvider>();

  routes.post(
    '/login',
    {
      schema: { body: LoginRequest, response: { 200: PublicUser } },
      config: {
        rateLimit: {
          max: api.config.loginRateLimitMax,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;
      const now = api.now();

      if (await lockedUntil(api.db, username, now)) {
        return sendError(
          reply,
          429,
          'too_many_attempts',
          'Too many failed attempts. Wait a few minutes and try again.',
        );
      }

      const user = await findUserByUsername(api.db, username);
      // An unknown username still verifies against a real hash, so it takes as long as a wrong password.
      const matches = await passwordHasher.verify(
        user?.passwordHash ?? (await getDummyHash()),
        password,
      );

      if (!user || !matches || !user.active) {
        await recordFailure(api.db, username, now);
        request.log.info({ outcome: 'login_failed' }, 'login failed');
        return sendError(reply, 401, 'invalid_credentials', INVALID);
      }

      await clearFailures(api.db, username);
      await api.db
        .update(users)
        .set({ lastLoginAt: now })
        .where(eq(users.id, user.id));
      const session = await createLoginSession(api.db, user, now);
      reply.setCookie(api.config.cookie.name, session.token, {
        ...cookieOptions(api.config),
        maxAge: session.maxAgeSeconds,
      });
      return toPublicUser(user);
    },
  );

  routes.post('/logout', async (request, reply) => {
    if (request.loginSessionId) {
      await deleteLoginSession(api.db, request.loginSessionId);
    }
    clearLoginCookie(reply, api.config);
    return reply.code(204).send();
  });
}
