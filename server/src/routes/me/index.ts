import { ChangePasswordRequest, PublicUser } from '@omp/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { users } from '../../db/schema.ts';
import { cookieOptions, requireLogin } from '../../plugins/auth.ts';
import { describeValidation, sendError } from '../../plugins/errors.ts';
import {
  checkPasswordRules,
  passwordHasher,
} from '../../services/auth/passwords.ts';
import {
  createLoginSession,
  deleteUserSessions,
} from '../../services/auth/sessions.ts';
import { toPublicUser } from '../../services/auth/users.ts';

export async function meRoutes(api: FastifyInstance) {
  const routes = api.withTypeProvider<ZodTypeProvider>();
  api.addHook('onRequest', requireLogin);

  routes.get(
    '/',
    { schema: { response: { 200: PublicUser } } },
    async (request) => {
      const user = request.user;
      if (!user) throw new Error('requireLogin let a request through');
      return toPublicUser(user);
    },
  );

  routes.post(
    '/password',
    { schema: { body: ChangePasswordRequest }, attachValidation: true },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new Error('requireLogin let a request through');

      if (request.validationError) {
        const issues: { instancePath: string; message?: string }[] =
          request.validationError.validation;
        const aboutNewPassword = issues.every((issue) =>
          issue.instancePath.startsWith('/newPassword'),
        );
        return aboutNewPassword
          ? sendError(
              reply,
              400,
              'weak_password',
              checkPasswordRules(
                String(
                  (request.body as { newPassword?: unknown }).newPassword ?? '',
                ),
                user.username,
              ) ?? describeValidation(issues),
            )
          : sendError(
              reply,
              400,
              'validation_failed',
              describeValidation(issues),
            );
      }

      const { currentPassword, newPassword } = request.body;
      if (!(await passwordHasher.verify(user.passwordHash, currentPassword))) {
        return sendError(
          reply,
          401,
          'wrong_current_password',
          'Your current password is not right',
        );
      }
      const problem = checkPasswordRules(newPassword, user.username);
      if (problem) return sendError(reply, 400, 'weak_password', problem);

      const now = api.now();
      const passwordHash = await passwordHasher.hash(newPassword);
      const session = await api.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ passwordHash, mustChangePassword: false, updatedAt: now })
          .where(eq(users.id, user.id));
        await deleteUserSessions(tx, user.id);
        return createLoginSession(tx, user, now);
      });
      reply.setCookie(api.config.cookie.name, session.token, {
        ...cookieOptions(api.config),
        maxAge: session.maxAgeSeconds,
      });
      return reply.code(204).send();
    },
  );
}
