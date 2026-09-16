import { describe, expect, it } from 'vitest';
import { Student, StudentInput, StudentUpdate } from './student.ts';

const id = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function input(overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: 'Ahmed Khan',
    pmdcNumber: '12345-P',
    level: 'medical_student',
    year: '3rd',
    ...overrides,
  };
}

describe('StudentInput', () => {
  it('accepts a medical student with a year', () => {
    expect(StudentInput.safeParse(input()).success).toBe(true);
  });

  describe('name: 2–100 characters, trimmed with spaces collapsed', () => {
    it('cleans spaces', () => {
      expect(StudentInput.parse(input({ name: '  Ahmed   Khan ' })).name).toBe(
        'Ahmed Khan',
      );
    });

    it.each(['A', ' A ', 'x'.repeat(101)])('refuses %j', (name) => {
      expect(StudentInput.safeParse(input({ name })).success).toBe(false);
    });
  });

  describe('PMDC number: optional, 3–20 letters, digits or hyphens, upper-case', () => {
    it('upper-cases and trims', () => {
      expect(
        StudentInput.parse(input({ pmdcNumber: ' 12345-p ' })).pmdcNumber,
      ).toBe('12345-P');
    });

    it.each(['', '   ', null, undefined])(
      'turns %j into null',
      (pmdcNumber) => {
        expect(StudentInput.parse(input({ pmdcNumber })).pmdcNumber).toBeNull();
      },
    );

    it.each(['12', '1234 5', '12345/P', 'x'.repeat(21)])(
      'refuses %j',
      (pmdcNumber) => {
        expect(StudentInput.safeParse(input({ pmdcNumber })).success).toBe(
          false,
        );
      },
    );
  });

  describe('year only for medical students', () => {
    it('accepts a house officer with no year', () => {
      expect(
        StudentInput.safeParse(input({ level: 'house_officer', year: null }))
          .success,
      ).toBe(true);
    });

    it('refuses a year for a resident', () => {
      const result = StudentInput.safeParse(
        input({ level: 'resident', year: '2nd' }),
      );
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['year']);
    });
  });

  it('refuses an ID that is not a UUID', () => {
    expect(StudentInput.safeParse(input({ id: '42' })).success).toBe(false);
  });

  it('refuses unknown fields', () => {
    expect(StudentInput.safeParse(input({ createdBy: id })).success).toBe(
      false,
    );
  });
});

describe('Student', () => {
  const student = {
    id,
    name: 'Sara Ahmed',
    pmdcNumber: null,
    level: 'resident',
    year: null,
    createdAt: '2026-09-17T04:15:00.000Z',
    updatedAt: '2026-09-17T04:15:00.000Z',
  };

  it('accepts a stored student', () => {
    expect(Student.safeParse(student).success).toBe(true);
  });

  it('refuses a year for a resident', () => {
    expect(Student.safeParse({ ...student, year: 'final' }).success).toBe(
      false,
    );
  });
});

describe('StudentUpdate', () => {
  it('accepts a name correction alone', () => {
    expect(StudentUpdate.safeParse({ name: 'Sara Ahmad' }).success).toBe(true);
  });

  it('refuses a year for a resident when both are sent', () => {
    expect(
      StudentUpdate.safeParse({ level: 'resident', year: '1st' }).success,
    ).toBe(false);
  });
});
