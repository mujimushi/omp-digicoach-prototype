import type { PublicUser } from '@omp/shared';
import { DepartmentKey, DesignationKey } from '@omp/shared';
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.ts';
import { lower, users } from '../../db/schema.ts';
import type { UserRow } from './sessions.ts';

/** The user without the password hash or timestamps. */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    department: DepartmentKey.nullable().catch(null).parse(user.department),
    designation: DesignationKey.nullable().catch(null).parse(user.designation),
    isDoctor: user.isDoctor,
    isAdmin: user.isAdmin,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    tourCompletedAt: user.tourCompletedAt?.toISOString() ?? null,
  };
}

export async function findUserByUsername(
  db: DbOrTx,
  username: string,
): Promise<UserRow | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(lower(users.username), username.toLowerCase()))
    .limit(1);
  return user;
}
