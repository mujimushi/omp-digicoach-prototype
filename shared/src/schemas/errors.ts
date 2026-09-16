import { z } from 'zod';

/** Every error code in docs/plan/api.md, plus `internal_error` for unexpected failures. */
export const ERROR_CODES = [
  'invalid_credentials',
  'too_many_attempts',
  'not_logged_in',
  'weak_password',
  'wrong_current_password',
  'database_unavailable',
  'validation_failed',
  'bad_cursor',
  'username_taken',
  'cannot_change_own_admin',
  'not_found',
  'pmdc_taken',
  'forbidden',
  'password_change_required',
  'unknown_student',
  'internal_error',
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.strictObject({
  code: ErrorCode,
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;
