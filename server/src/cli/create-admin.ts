import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { type PublicUser, Username } from '@omp/shared';
import { z } from 'zod';
import { createDatabase, type Db } from '../db/client.ts';
import { auditLog, users } from '../db/schema.ts';
import {
  checkPasswordRules,
  generateTemporaryPassword,
  hashPassword,
} from '../services/auth/passwords.ts';
import { findUserByUsername, toPublicUser } from '../services/auth/users.ts';

const AdminArgs = z.object({
  name: z.string().trim().min(2).max(100),
  username: Username,
});
export type AdminArgs = z.input<typeof AdminArgs>;

export function readableTemporaryPassword(username: string): string {
  for (;;) {
    const password = generateTemporaryPassword();
    if (checkPasswordRules(password, username) === null) return password;
  }
}

/**
 * Makes an admin who must change the temporary password at first login. Admins don't teach:
 * doctors and admins log in separately.
 */
export async function createAdmin(
  db: Db,
  args: AdminArgs,
): Promise<{ user: PublicUser; temporaryPassword: string }> {
  const input = AdminArgs.parse(args);
  if (await findUserByUsername(db, input.username)) {
    throw new Error(`The username "${input.username}" is taken.`);
  }

  const temporaryPassword = readableTemporaryPassword(input.username);
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        name: input.name,
        username: input.username,
        passwordHash,
        department: null,
        designation: null,
        isDoctor: false,
        isAdmin: true,
        mustChangePassword: true,
      })
      .returning();
    if (!row) throw new Error('The admin was not created.');
    const created = toPublicUser(row);
    await tx.insert(auditLog).values({
      actorId: null,
      action: 'admin.create_from_command_line',
      entityType: 'user',
      entityId: row.id,
      before: null,
      after: created,
    });
    return created;
  });

  return { user, temporaryPassword };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      username: { type: 'string' },
    },
  });
  const url = process.env.DATABASE_URL;
  if (!url || !values.name || !values.username) {
    console.error(
      'Usage: npm run create-admin -w server -- --name "Full Name" --username name',
    );
    process.exit(1);
  }
  const { db, pool } = createDatabase({
    url,
    caCert: process.env.DATABASE_CA_CERT,
  });
  try {
    const { user, temporaryPassword } = await createAdmin(db, {
      name: values.name,
      username: values.username,
    });
    console.log(`Created admin ${user.username}.`);
    console.log(`Temporary password (shown once): ${temporaryPassword}`);
    console.log(
      'Give it in person or by phone. They must change it at first login.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
