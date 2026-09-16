import { type PushEnvelope, PushItem, type PushResult } from '@omp/shared';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { lockChangeCounter } from '../../db/change-seq.ts';
import type { Db, Tx } from '../../db/client.ts';
import { processedOps } from '../../db/schema.ts';
import { deletePearl, upsertPearl, usePearl } from '../pearls/index.ts';
import { createSession } from '../sessions/create.ts';
import { upsertStudent } from '../students/upsert.ts';
import { type ItemOutcome, rejected } from './results.ts';

type EnvelopeItem = PushEnvelope['items'][number];

const UNIQUE_VIOLATION = '23505';
const DEADLOCK = '40P01';

function pgCode(error: unknown): string | undefined {
  const withCause = error as { code?: string; cause?: { code?: string } };
  return withCause.cause?.code ?? withCause.code;
}

async function applyItem(
  tx: Tx,
  userId: string,
  item: PushItem,
  now: Date,
): Promise<ItemOutcome> {
  switch (item.type) {
    case 'student.upsert':
      return upsertStudent(tx, userId, item.payload, now);
    case 'session.create':
      return createSession(tx, userId, item.payload, now);
    case 'pearl.upsert':
      return upsertPearl(tx, userId, item.payload, now);
    case 'pearl.delete':
      return deletePearl(tx, userId, item.payload.id, now);
    case 'pearl.use':
      return usePearl(tx, userId, item.payload.id);
  }
}

/** One item in its own transaction: look up the opId, check the payload, apply, record. */
async function pushOne(
  db: Db,
  userId: string,
  item: EnvelopeItem,
  now: Date,
): Promise<ItemOutcome> {
  return db.transaction(async (tx) => {
    const [seen] = await tx
      .select()
      .from(processedOps)
      .where(eq(processedOps.opId, item.opId));
    if (seen) {
      // Another user's opId is never this caller's item.
      if (seen.userId !== userId) return rejected('forbidden');
      const stored = seen.result as ItemOutcome;
      // A refusal stays a refusal, so the phone keeps it for the doctor to see.
      return stored.status === 'rejected'
        ? stored
        : { ...stored, status: 'duplicate' };
    }

    const parsed = PushItem.safeParse(item);
    const outcome: ItemOutcome = parsed.success
      ? await (async () => {
          await lockChangeCounter(tx);
          return applyItem(tx, userId, parsed.data, now);
        })()
      : rejected('validation_failed');

    // unknown_student isn't stored: the phone retries the same item after sending the student.
    if (outcome.code !== 'unknown_student') {
      await tx.insert(processedOps).values({
        opId: item.opId,
        userId,
        type: item.type,
        result: outcome,
        createdAt: now,
      });
    }
    return outcome;
  });
}

/**
 * Applies push items strictly in order, each in its own transaction, so one refused item never
 * undoes the others. Logs each item's opId, type and result, never its payload.
 */
export async function pushItems(
  db: Db,
  userId: string,
  items: readonly EnvelopeItem[],
  now: Date,
  log: FastifyBaseLogger,
): Promise<PushResult[]> {
  const results: PushResult[] = [];
  for (const item of items) {
    let outcome: ItemOutcome;
    try {
      outcome = await pushOne(db, userId, item, now);
    } catch (error) {
      // The same item or record arrived twice at once: try again, now that the other has committed.
      const code = pgCode(error);
      if (code !== UNIQUE_VIOLATION && code !== DEADLOCK) throw error;
      outcome = await pushOne(db, userId, item, now);
    }
    log.info(
      {
        opId: item.opId,
        type: item.type,
        status: outcome.status,
        code: outcome.code,
      },
      'push item',
    );
    results.push({ opId: item.opId, ...outcome });
  }
  return results;
}
