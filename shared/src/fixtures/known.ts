import type { Level, Year } from '../constants.ts';

/**
 * The small known data set that `npm run db:reset-test` loads for end-to-end tests. Tests refer to
 * these records by ID and log in with these passwords. Never used outside tests.
 */
export const KNOWN_PASSWORD = 'ward round teaching practice';

export const KNOWN_USERS = {
  admin: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Admin Nasreen',
    username: 'admin',
    department: null,
    designation: null,
    isDoctor: false,
    isAdmin: true,
  },
  doctor: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Dr. Hina Qureshi',
    username: 'doctor.one',
    department: 'medicine',
    designation: 'consultant',
    isDoctor: true,
    isAdmin: false,
  },
  secondDoctor: {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Dr. Omar Siddiqui',
    username: 'doctor.two',
    department: 'surgery',
    designation: 'registrar',
    isDoctor: true,
    isAdmin: false,
  },
} as const;

export type KnownUserKey = keyof typeof KNOWN_USERS;

export const KNOWN_STUDENTS: readonly {
  id: string;
  name: string;
  pmdcNumber: string | null;
  level: Level;
  year: Year | null;
}[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Ahmed Khan',
    pmdcNumber: '12345-P',
    level: 'medical_student',
    year: '3rd',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Fatima Rizvi',
    pmdcNumber: '23456-P',
    level: 'medical_student',
    year: '4th',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: 'Bilal Hussain',
    pmdcNumber: null,
    level: 'house_officer',
    year: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'Nadia Qamar',
    pmdcNumber: '34567-D',
    level: 'resident',
    year: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    name: 'Sara Ahmed',
    pmdcNumber: null,
    level: 'medical_student',
    year: 'final',
  },
];

/** Sessions per known doctor that the reset loads, spread over the last 20 days. */
export const KNOWN_SESSION_COUNTS = { doctor: 6, secondDoctor: 4 } as const;
