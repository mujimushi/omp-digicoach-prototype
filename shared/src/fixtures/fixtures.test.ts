import { describe, expect, it } from 'vitest';
import { Pearl } from '../schemas/pearl.ts';
import { TeachingSession } from '../schemas/session.ts';
import { Student, StudentInput } from '../schemas/student.ts';
import { PublicUser } from '../schemas/user.ts';
import { createFixtures } from './index.ts';

const COUNT = 200;

function expectAllValid(
  schema: { safeParse: (value: unknown) => { success: boolean } },
  records: unknown[],
) {
  const invalid = records.filter((record) => !schema.safeParse(record).success);
  expect(invalid).toEqual([]);
}

describe('fixtures', () => {
  const fixtures = createFixtures(42);

  it(`builds ${COUNT} doctors that pass PublicUser`, () => {
    expectAllValid(
      PublicUser,
      Array.from({ length: COUNT }, () => fixtures.makeDoctor()),
    );
  });

  it(`builds ${COUNT} students that pass Student and StudentInput`, () => {
    expectAllValid(
      Student,
      Array.from({ length: COUNT }, () => fixtures.makeStudent()),
    );
    expectAllValid(
      StudentInput,
      Array.from({ length: COUNT }, () => fixtures.makeStudentInput()),
    );
  });

  it(`builds ${COUNT} sessions that pass TeachingSession`, () => {
    expectAllValid(
      TeachingSession,
      Array.from({ length: COUNT }, () => fixtures.makeSession()),
    );
  });

  it(`builds ${COUNT} pearls that pass Pearl`, () => {
    expectAllValid(
      Pearl,
      Array.from({ length: COUNT }, () => fixtures.makePearl()),
    );
  });

  it('builds the same records from the same seed', () => {
    const a = createFixtures(7);
    const b = createFixtures(7);
    expect([a.makeDoctor(), a.makeStudent(), a.makeSession()]).toEqual([
      b.makeDoctor(),
      b.makeStudent(),
      b.makeSession(),
    ]);
  });

  it('gives each doctor a unique username and each student a unique PMDC number', () => {
    const local = createFixtures(3);
    const doctors = Array.from({ length: COUNT }, () => local.makeDoctor());
    const students = Array.from({ length: COUNT }, () => local.makeStudent());
    const pmdc = students.flatMap((s) => (s.pmdcNumber ? [s.pmdcNumber] : []));

    expect(new Set(doctors.map((d) => d.username)).size).toBe(COUNT);
    expect(new Set(pmdc).size).toBe(pmdc.length);
  });
});
