import {
  DoctorActivityRow,
  DoctorCreated,
  DoctorDetail,
  DoctorInput,
  DoctorUpdate,
  ExportQuery,
  IdParams,
  OverviewStats,
  PublicUser,
  SessionDetail,
  SessionFilters,
  SessionPage,
  Student,
  StudentDetail,
  StudentSummaryRow,
  StudentsQuery,
  StudentUpdate,
  TemporaryPasswordResponse,
} from '@omp/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.ts';
import { sendError } from '../../plugins/errors.ts';
import {
  createDoctor,
  DoctorError,
  getDoctorDetail,
  listDoctors,
  resetDoctorPassword,
  updateDoctor,
} from '../../services/doctors/index.ts';
import { buildSessionsCsv } from '../../services/reports/csv.ts';
import { getOverview } from '../../services/reports/overview.ts';
import {
  deleteSession,
  getSessionDetail,
  listSessions,
} from '../../services/reports/sessions.ts';
import {
  correctStudent,
  getStudentDetail,
  listStudentSummaries,
} from '../../services/reports/students.ts';

function actorOf(request: FastifyRequest): string {
  const user = request.user;
  if (!user) throw new Error('requireAdmin let a request through');
  return user.id;
}

/** The dashboard's routes. The admin check is a hook on the plugin, so no route can miss it. */
export async function adminRoutes(api: FastifyInstance) {
  api.addHook('onRequest', requireAdmin);
  const routes = api.withTypeProvider<ZodTypeProvider>();

  routes.get(
    '/overview',
    { schema: { response: { 200: OverviewStats } } },
    async () => getOverview(api.db, api.now()),
  );

  routes.get(
    '/doctors',
    { schema: { response: { 200: z.array(DoctorActivityRow) } } },
    async () => listDoctors(api.db, api.now()),
  );

  routes.post(
    '/doctors',
    { schema: { body: DoctorInput, response: { 200: DoctorCreated } } },
    async (request, reply) => {
      try {
        return await createDoctor(
          api.db,
          actorOf(request),
          request.body,
          api.now(),
        );
      } catch (error) {
        if (!(error instanceof DoctorError)) throw error;
        return sendError(
          reply,
          error.code === 'username_taken' ? 409 : 400,
          error.code,
          error.message,
        );
      }
    },
  );

  routes.get(
    '/doctors/:id',
    { schema: { params: IdParams, response: { 200: DoctorDetail } } },
    async (request, reply) => {
      const detail = await getDoctorDetail(
        api.db,
        request.params.id,
        api.now(),
      );
      return detail ?? sendError(reply, 404, 'not_found', 'No such doctor');
    },
  );

  routes.patch(
    '/doctors/:id',
    {
      schema: {
        params: IdParams,
        body: DoctorUpdate,
        response: { 200: PublicUser },
      },
    },
    async (request, reply) => {
      try {
        const updated = await updateDoctor(
          api.db,
          actorOf(request),
          request.params.id,
          request.body,
          api.now(),
        );
        return updated ?? sendError(reply, 404, 'not_found', 'No such doctor');
      } catch (error) {
        if (!(error instanceof DoctorError)) throw error;
        const status =
          error.code === 'validation_failed' || error.code === 'weak_password'
            ? 400
            : 409;
        return sendError(reply, status, error.code, error.message);
      }
    },
  );

  routes.post(
    '/doctors/:id/reset-password',
    {
      schema: {
        params: IdParams,
        response: { 200: TemporaryPasswordResponse },
      },
    },
    async (request, reply) => {
      const temporaryPassword = await resetDoctorPassword(
        api.db,
        actorOf(request),
        request.params.id,
        api.now(),
      );
      return temporaryPassword === undefined
        ? sendError(reply, 404, 'not_found', 'No such doctor')
        : { temporaryPassword };
    },
  );

  routes.get(
    '/students',
    {
      schema: {
        querystring: StudentsQuery,
        response: { 200: z.array(StudentSummaryRow) },
      },
    },
    async (request) => listStudentSummaries(api.db, request.query),
  );

  routes.get(
    '/students/:id',
    { schema: { params: IdParams, response: { 200: StudentDetail } } },
    async (request, reply) => {
      const detail = await getStudentDetail(api.db, request.params.id);
      return detail ?? sendError(reply, 404, 'not_found', 'No such student');
    },
  );

  routes.patch(
    '/students/:id',
    {
      schema: {
        params: IdParams,
        body: StudentUpdate,
        response: { 200: Student },
      },
    },
    async (request, reply) => {
      const result = await correctStudent(
        api.db,
        actorOf(request),
        request.params.id,
        request.body,
        api.now(),
      );
      switch (result.status) {
        case 'updated':
          return result.student;
        case 'not_found':
          return sendError(reply, 404, 'not_found', 'No such student');
        case 'pmdc_taken':
          return sendError(
            reply,
            409,
            'pmdc_taken',
            'Another student has that PMDC number',
          );
        case 'invalid':
          return sendError(reply, 400, 'validation_failed', result.message);
      }
    },
  );

  routes.get(
    '/sessions',
    { schema: { querystring: SessionFilters, response: { 200: SessionPage } } },
    async (request) => listSessions(api.db, request.query),
  );

  routes.get(
    '/sessions/:id',
    { schema: { params: IdParams, response: { 200: SessionDetail } } },
    async (request, reply) => {
      const detail = await getSessionDetail(api.db, request.params.id);
      return detail ?? sendError(reply, 404, 'not_found', 'No such session');
    },
  );

  routes.delete(
    '/sessions/:id',
    { schema: { params: IdParams } },
    async (request, reply) => {
      const deleted = await deleteSession(
        api.db,
        actorOf(request),
        request.params.id,
        api.now(),
      );
      return deleted
        ? reply.code(204).send()
        : sendError(reply, 404, 'not_found', 'No such session');
    },
  );

  routes.get(
    '/export/sessions.csv',
    { schema: { querystring: ExportQuery } },
    async (request, reply) => {
      const { csv, filename } = await buildSessionsCsv(
        api.db,
        actorOf(request),
        request.query,
        api.now(),
      );
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${filename}"`)
        .header('cache-control', 'no-store')
        .send(csv);
    },
  );
}
