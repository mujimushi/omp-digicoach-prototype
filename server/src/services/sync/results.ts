import type { PushRejectCode, PushResult } from '@omp/shared';

/** A push result without its opId, which the caller adds. */
export type ItemOutcome = Omit<PushResult, 'opId'>;

export const applied = (mappedStudentId?: string): ItemOutcome =>
  mappedStudentId
    ? { status: 'applied', mappedStudentId }
    : { status: 'applied' };

export const duplicate = (mappedStudentId?: string): ItemOutcome =>
  mappedStudentId
    ? { status: 'duplicate', mappedStudentId }
    : { status: 'duplicate' };

export const rejected = (code: PushRejectCode): ItemOutcome => ({
  status: 'rejected',
  code,
});
