import { describe, expect, it } from 'vitest';
import {
  PullResponse,
  PushEnvelope,
  PushItem,
  PushRequest,
  PushResult,
} from './sync.ts';

const opId = '0b6c1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e';
const studentId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const studentItem = {
  opId,
  type: 'student.upsert',
  payload: {
    id: studentId,
    name: 'Ahmed Khan',
    pmdcNumber: null,
    level: 'resident',
    year: null,
  },
};

describe('PushItem', () => {
  it('accepts a student upsert', () => {
    expect(PushItem.safeParse(studentItem).success).toBe(true);
  });

  it('accepts pearl delete and use with an ID only', () => {
    for (const type of ['pearl.delete', 'pearl.use']) {
      expect(
        PushItem.safeParse({ opId, type, payload: { id: studentId } }).success,
      ).toBe(true);
    }
  });

  it('refuses an unknown type', () => {
    expect(
      PushItem.safeParse({ ...studentItem, type: 'student.delete' }).success,
    ).toBe(false);
  });

  it('refuses a payload that fails its own schema', () => {
    expect(
      PushItem.safeParse({
        ...studentItem,
        payload: { ...studentItem.payload, year: '2nd' },
      }).success,
    ).toBe(false);
  });
});

describe('PushRequest', () => {
  it('accepts 1 to 50 items', () => {
    expect(PushRequest.safeParse({ items: [studentItem] }).success).toBe(true);
    expect(
      PushRequest.safeParse({ items: Array(50).fill(studentItem) }).success,
    ).toBe(true);
  });

  it('refuses no items and 51 items', () => {
    expect(PushRequest.safeParse({ items: [] }).success).toBe(false);
    expect(
      PushRequest.safeParse({ items: Array(51).fill(studentItem) }).success,
    ).toBe(false);
  });
});

describe('PushEnvelope, which the route checks', () => {
  it('accepts an item whose payload is wrong, so only that item is refused later', () => {
    expect(
      PushEnvelope.safeParse({
        items: [{ opId, type: 'session.create', payload: { steps: [] } }],
      }).success,
    ).toBe(true);
  });

  it('refuses a batch that is not an array', () => {
    expect(PushEnvelope.safeParse({ items: studentItem }).success).toBe(false);
  });

  it('refuses an item without opId or type', () => {
    expect(
      PushEnvelope.safeParse({ items: [{ type: 'student.upsert' }] }).success,
    ).toBe(false);
    expect(PushEnvelope.safeParse({ items: [{ opId }] }).success).toBe(false);
  });

  it('refuses 51 items', () => {
    expect(
      PushEnvelope.safeParse({ items: Array(51).fill(studentItem) }).success,
    ).toBe(false);
  });
});

describe('PushResult', () => {
  it('accepts applied with a mapped student', () => {
    expect(
      PushResult.safeParse({
        opId,
        status: 'applied',
        mappedStudentId: studentId,
      }).success,
    ).toBe(true);
  });

  it('refuses an unknown refusal code', () => {
    expect(
      PushResult.safeParse({ opId, status: 'rejected', code: 'nope' }).success,
    ).toBe(false);
  });
});

describe('PullResponse', () => {
  it('accepts an empty change set', () => {
    expect(
      PullResponse.safeParse({
        cursor: '0',
        students: [],
        studentAliases: [],
        sessions: [],
        pearls: [],
      }).success,
    ).toBe(true);
  });

  it('refuses a response without a cursor', () => {
    expect(
      PullResponse.safeParse({
        students: [],
        studentAliases: [],
        sessions: [],
        pearls: [],
      }).success,
    ).toBe(false);
  });
});
