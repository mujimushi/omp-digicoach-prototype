import { HealthResponse } from '@omp/shared';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sendError } from '../plugins/errors.ts';

export async function healthRoutes(api: FastifyInstance) {
  api
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/health',
      { schema: { response: { 200: HealthResponse } } },
      async (request, reply) => {
        try {
          await api.db.execute(sql`select 1`);
        } catch (error) {
          request.log.error(
            {
              err: {
                message: error instanceof Error ? error.message : 'unknown',
              },
            },
            'database ping failed',
          );
          return sendError(
            reply,
            503,
            'database_unavailable',
            'The database is not answering',
          );
        }
        return { ok: true as const };
      },
    );
}
