import { z } from 'zod';
import { LIMITS } from '../constants.ts';

export const LoginRequest = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(LIMITS.passwordMax),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/**
 * Length rules only. The server also checks the common-password list, the app's name and the
 * username (NIST SP 800-63B-4). No composition rules.
 */
export const NewPassword = z
  .string()
  .min(
    LIMITS.passwordMin,
    `Use at least ${LIMITS.passwordMin} characters. A phrase of several words works well.`,
  )
  .max(LIMITS.passwordMax, `Use at most ${LIMITS.passwordMax} characters`);

export const ChangePasswordRequest = z.strictObject({
  currentPassword: z.string().min(1).max(LIMITS.passwordMax),
  newPassword: NewPassword,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

export const HealthResponse = z.strictObject({ ok: z.literal(true) });
