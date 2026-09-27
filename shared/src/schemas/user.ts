import { z } from 'zod';
import { DepartmentKey, DesignationKey, Id, IsoDateTime } from './common.ts';

export const PublicUser = z.strictObject({
  id: Id,
  name: z.string(),
  username: z.string(),
  /** Null for an admin who doesn't teach, such as one made with `create-admin`. */
  department: DepartmentKey.nullable(),
  designation: DesignationKey.nullable(),
  isDoctor: z.boolean(),
  isAdmin: z.boolean(),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  /** When the doctor finished or skipped the app tour. Null until then. */
  tourCompletedAt: IsoDateTime.nullable(),
});
export type PublicUser = z.infer<typeof PublicUser>;
