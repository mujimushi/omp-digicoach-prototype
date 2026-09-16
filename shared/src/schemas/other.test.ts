import { describe, expect, it } from 'vitest';
import {
  CSV_COLUMNS,
  DoctorInput,
  DoctorUpdate,
  SessionFilters,
} from './admin.ts';
import { ChangePasswordRequest, LoginRequest } from './auth.ts';
import { ApiError } from './errors.ts';
import { Pearl } from './pearl.ts';
import { PublicUser } from './user.ts';

const id = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('PublicUser', () => {
  const user = {
    id,
    name: 'Dr. Sana Malik',
    username: 'dr.sana',
    department: 'medicine',
    designation: 'consultant',
    isDoctor: true,
    isAdmin: false,
    active: true,
    mustChangePassword: true,
  };

  it('accepts a doctor', () => {
    expect(PublicUser.safeParse(user).success).toBe(true);
  });

  it('refuses a password hash field', () => {
    expect(PublicUser.safeParse({ ...user, passwordHash: 'x' }).success).toBe(
      false,
    );
  });

  it('refuses a department not in the list', () => {
    expect(
      PublicUser.safeParse({ ...user, department: 'cardiology' }).success,
    ).toBe(false);
  });
});

describe('LoginRequest', () => {
  it('lower-cases and trims the username', () => {
    expect(
      LoginRequest.parse({ username: ' Dr.Sana ', password: 'x' }).username,
    ).toBe('dr.sana');
  });

  it('refuses an empty password', () => {
    expect(
      LoginRequest.safeParse({ username: 'dr.sana', password: '' }).success,
    ).toBe(false);
  });
});

describe('ChangePasswordRequest: 15 to 128 characters, no composition rules', () => {
  it('accepts 15 lower-case letters and spaces', () => {
    expect(
      ChangePasswordRequest.safeParse({
        currentPassword: 'old',
        newPassword: 'blue tea garden',
      }).success,
    ).toBe(true);
  });

  it('refuses 14 characters', () => {
    expect(
      ChangePasswordRequest.safeParse({
        currentPassword: 'old',
        newPassword: 'x'.repeat(14),
      }).success,
    ).toBe(false);
  });

  it('refuses 129 characters', () => {
    expect(
      ChangePasswordRequest.safeParse({
        currentPassword: 'old',
        newPassword: 'x'.repeat(129),
      }).success,
    ).toBe(false);
  });
});

describe('Pearl', () => {
  const pearl = {
    id,
    diagnosis: 'Pneumonia',
    points: ['CURB-65', '', '', '', ''],
    timesUsed: 0,
    updatedAt: '2026-09-17T04:15:00.000Z',
    deleted: false,
  };

  it('accepts five points', () => {
    expect(Pearl.safeParse(pearl).success).toBe(true);
  });

  it('refuses four points', () => {
    expect(
      Pearl.safeParse({ ...pearl, points: ['', '', '', ''] }).success,
    ).toBe(false);
  });

  it('refuses an empty diagnosis', () => {
    expect(Pearl.safeParse({ ...pearl, diagnosis: '  ' }).success).toBe(false);
  });
});

describe('ApiError', () => {
  it('accepts a listed code', () => {
    expect(
      ApiError.safeParse({ code: 'pmdc_taken', message: 'Taken' }).success,
    ).toBe(true);
  });

  it('refuses an unlisted code', () => {
    expect(ApiError.safeParse({ code: 'oops', message: 'x' }).success).toBe(
      false,
    );
  });
});

describe('DoctorInput', () => {
  const doctor = {
    name: 'Dr. Sana Malik',
    username: 'Dr.Sana',
    department: 'medicine',
    designation: 'consultant',
  };

  it('accepts a doctor and lower-cases the username', () => {
    const parsed = DoctorInput.parse(doctor);
    expect(parsed.username).toBe('dr.sana');
    expect(parsed.isDoctor).toBe(true);
    expect(parsed.isAdmin).toBe(false);
  });

  it.each(['ab', 'dr sana', 'dr-sana', 'x'.repeat(31)])(
    'refuses the username %j',
    (username) => {
      expect(DoctorInput.safeParse({ ...doctor, username }).success).toBe(
        false,
      );
    },
  );

  it('refuses a doctor without a department', () => {
    expect(DoctorInput.safeParse({ ...doctor, department: null }).success).toBe(
      false,
    );
  });

  it('accepts an admin who does not teach without a department', () => {
    expect(
      DoctorInput.safeParse({
        ...doctor,
        department: null,
        designation: null,
        isDoctor: false,
        isAdmin: true,
      }).success,
    ).toBe(true);
  });

  it('refuses a typed temporary password under 15 characters', () => {
    expect(
      DoctorInput.safeParse({ ...doctor, temporaryPassword: 'short' }).success,
    ).toBe(false);
  });
});

describe('DoctorUpdate', () => {
  it('accepts switching a doctor off', () => {
    expect(DoctorUpdate.safeParse({ active: false }).success).toBe(true);
  });

  it('refuses a password field', () => {
    expect(DoctorUpdate.safeParse({ passwordHash: 'x' }).success).toBe(false);
  });
});

describe('SessionFilters', () => {
  it('reads query strings, treating empty values as absent', () => {
    expect(
      SessionFilters.parse({ from: '2026-09-01', to: '', page: '2' }),
    ).toEqual({ from: '2026-09-01', page: 2 });
  });

  it('refuses a start date after the end date', () => {
    expect(
      SessionFilters.safeParse({ from: '2026-09-10', to: '2026-09-01' })
        .success,
    ).toBe(false);
  });

  it('refuses a malformed date and page 0', () => {
    expect(SessionFilters.safeParse({ from: '1/9/2026' }).success).toBe(false);
    expect(SessionFilters.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('CSV_COLUMNS', () => {
  it('has 35 columns, starting with session_id and ending with app_version', () => {
    expect(CSV_COLUMNS).toHaveLength(35);
    expect(CSV_COLUMNS[0]).toBe('session_id');
    expect(CSV_COLUMNS.at(-1)).toBe('app_version');
  });
});
