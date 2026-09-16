import {
  PullQuery,
  PullResponse,
  PushEnvelope,
  PushResponse,
} from '@omp/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireDoctor } from '../../plugins/auth.ts';
import { sendError } from '../../plugins/errors.ts';
import { decodeCursor, pullChanges } from '../../services/sync/pull.ts';
import { pushItems } from '../../services/sync/push.ts';

/** The doctor app's only two routes. */
export async function syncRoutes(api: FastifyInstance) {
  const routes = api.withTypeProvider<ZodTypeProvider>();
  api.addHook('onRequest', requireDoctor);

  routes.post(
    '/push',
    {
      // The route checks the batch only; each payload is checked on its own.
      schema: { body: PushEnvelope, response: { 200: PushResponse } },
      bodyLimit: 4 * 1024 * 1024,
    },
    async (request) => {
      const user = request.user;
      if (!user) throw new Error('requireDoctor let a request through');
      const results = await pushItems(
        api.db,
        user.id,
        request.body.items,
        api.now(),
        request.log,
      );
      return { results };
    },
  );

  routes.get(
    '/pull',
    { schema: { querystring: PullQuery, response: { 200: PullResponse } } },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new Error('requireDoctor let a request through');
      const cursor = decodeCursor(request.query.cursor);
      if (cursor === null) {
        return sendError(
          reply,
          400,
          'bad_cursor',
          'The sync position is not valid',
        );
      }
      return pullChanges(api.db, user.id, cursor);
    },
  );
}
