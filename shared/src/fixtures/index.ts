import {
  CASE_TYPES,
  DEPARTMENTS,
  DESIGNATIONS,
  LEVELS,
  type Level,
  STEP4_TAGS,
  YEARS,
  type Year,
} from '../constants.ts';
import type { Pearl } from '../schemas/pearl.ts';
import {
  overtimeFor,
  type SessionStep,
  type TeachingSession,
} from '../schemas/session.ts';
import type { Student, StudentInput } from '../schemas/student.ts';
import type { PublicUser } from '../schemas/user.ts';
import {
  chance,
  createRng,
  pick,
  type Rng,
  randomInt,
  randomUuid,
} from './random.ts';

export { createRng, pick, type Rng, randomInt, randomUuid } from './random.ts';

const FIRST_NAMES = [
  'Ahmed',
  'Fatima',
  'Hassan',
  'Ayesha',
  'Usman',
  'Sara',
  'Bilal',
  'Nadia',
  'Ali',
  'Zainab',
  'Omar',
  'Hina',
  'Hamza',
  'Maryam',
  'Saad',
  'Sana',
  'Imran',
  'Rabia',
  'Faisal',
  'Amna',
  'Kamran',
  'Mehwish',
  'Tariq',
  'Sadaf',
  'Asad',
  'Iqra',
  'Junaid',
  'Nimra',
  'Waqas',
  'Kiran',
] as const;

const LAST_NAMES = [
  'Khan',
  'Rizvi',
  'Malik',
  'Tariq',
  'Ahmed',
  'Hussain',
  'Qamar',
  'Shah',
  'Siddiqui',
  'Chaudhry',
  'Butt',
  'Qureshi',
  'Javed',
  'Iqbal',
  'Raza',
  'Mirza',
  'Abbasi',
  'Sheikh',
  'Anwar',
  'Aslam',
] as const;

export const FIXTURE_DIAGNOSES = [
  'Pneumonia',
  'Community acquired pneumonia',
  'Appendicitis',
  'CHF exacerbation',
  'Measles',
  'Acute asthma',
  'Diabetic ketoacidosis',
  'Type 2 diabetes',
  'Hypertension',
  'Pulmonary tuberculosis',
  'Dengue fever',
  'Typhoid fever',
  'Acute gastroenteritis',
  'Iron deficiency anaemia',
  'Urinary tract infection',
  'Cellulitis',
  'Ischaemic stroke',
  'Myocardial infarction',
  'COPD exacerbation',
  'Malaria',
] as const;

const TEACHING_POINTS = [
  'CURB-65 score guides admission',
  'oxygen saturation',
  'Amoxicillin for community-acquired cases',
  'Multilobar infiltrates with sepsis',
  'Alvarado score helps',
  'rebound tenderness',
  'Laparoscopic appendectomy',
  'Perforation risk after 48 hours',
  'Daily weights guide diuretics',
  'Silent chest means severe asthma',
  'Fixed-rate insulin infusion',
  'potassium before insulin',
  'Koplik spots',
  'Encephalitis as a complication',
  'Fluid balance charts',
] as const;

const STRENGTHS = [
  'identifying key differentials',
  'taking a focused history',
  'structuring your presentation',
  'examining systematically',
  'explaining the plan clearly',
  'linking findings to the diagnosis',
] as const;

const IMPROVEMENTS = [
  'review the chest X-ray systematically',
  'check for red flags early',
  'the drug doses',
  'a broader differential',
  'documenting vital signs',
  'asking about allergies',
] as const;

const ACTION_PLANS = [
  'Read the national guideline chapter',
  'Review the case notes tomorrow',
  'Present this case at the morning meeting',
  '',
] as const;

const BASE_TIME = Date.UTC(2026, 5, 1, 3, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

type DoctorOverrides = Partial<PublicUser>;
type StudentOverrides = Partial<Student>;
type SessionOverrides = Partial<Omit<TeachingSession, 'steps'>> & {
  studentId?: string;
  ratings?: readonly (1 | 2 | 3 | 4 | 5 | null)[];
};
type PearlOverrides = Partial<Pearl>;

/**
 * Factories for test and seed records. Every call draws from one seeded generator, so a given seed
 * always builds the same records in the same order.
 */
export function createFixtures(seed = 1) {
  const rng: Rng = createRng(seed);
  const usedUsernames = new Set<string>();
  const usedPmdcNumbers = new Set<string>();

  function personName(): string {
    return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  }

  function uniqueUsername(name: string): string {
    const base = `dr.${name.toLowerCase().replace(/[^a-z]+/g, '.')}`.slice(
      0,
      26,
    );
    let username = base;
    for (let n = 2; usedUsernames.has(username); n += 1) {
      username = `${base}${n}`;
    }
    usedUsernames.add(username);
    return username;
  }

  function uniquePmdcNumber(): string {
    let pmdc: string;
    do {
      pmdc = `${randomInt(rng, 10000, 99999)}-${pick(rng, ['P', 'D', 'N'])}`;
    } while (usedPmdcNumbers.has(pmdc));
    usedPmdcNumbers.add(pmdc);
    return pmdc;
  }

  function levelAndYear(): { level: Level; year: Year | null } {
    const level = chance(rng, 0.7) ? 'medical_student' : pick(rng, LEVELS);
    return {
      level,
      year: level === 'medical_student' ? pick(rng, YEARS) : null,
    };
  }

  function makeDoctor(overrides: DoctorOverrides = {}): PublicUser {
    const name = overrides.name ?? `Dr. ${personName()}`;
    return {
      id: randomUuid(rng),
      name,
      username: overrides.username ?? uniqueUsername(name.replace('Dr. ', '')),
      department: pick(rng, DEPARTMENTS),
      designation: pick(rng, DESIGNATIONS),
      isDoctor: true,
      isAdmin: false,
      active: true,
      mustChangePassword: false,
      ...overrides,
    };
  }

  function makeStudentInput(
    overrides: Partial<StudentInput> = {},
  ): StudentInput {
    return {
      id: randomUuid(rng),
      name: personName(),
      pmdcNumber: chance(rng, 0.75) ? uniquePmdcNumber() : null,
      ...levelAndYear(),
      ...overrides,
    };
  }

  function makeStudent(overrides: StudentOverrides = {}): Student {
    const createdAt = new Date(
      BASE_TIME + randomInt(rng, 0, 20) * DAY_MS,
    ).toISOString();
    return {
      ...makeStudentInput(),
      createdAt,
      updatedAt: createdAt,
      ...overrides,
    };
  }

  function rating(): 1 | 2 | 3 | 4 | 5 | null {
    return chance(rng, 0.1)
      ? null
      : (randomInt(rng, 1, 5) as 1 | 2 | 3 | 4 | 5);
  }

  function splitSeconds(
    total: number,
  ): [number, number, number, number, number] {
    const weights = Array.from({ length: 5 }, () => rng() + 0.2);
    const sum = weights.reduce((a, b) => a + b, 0);
    const parts = weights.map((w) => Math.floor((w / sum) * total));
    const rest = total - parts.reduce((a, b) => a + b, 0);
    parts[4] = (parts[4] as number) + rest;
    return parts as [number, number, number, number, number];
  }

  function makeSession(overrides: SessionOverrides = {}): TeachingSession {
    const { ratings: ratingOverrides, ...fields } = overrides;
    const { level, year } = levelAndYear();
    const diagnosis = pick(rng, FIXTURE_DIAGNOSES);
    const teachingSeconds =
      fields.teachingSeconds ??
      (chance(rng, 0.4) ? randomInt(rng, 25, 60) : randomInt(rng, 61, 240));
    const stepSeconds = splitSeconds(teachingSeconds);
    const ratings = Array.from(
      { length: 5 },
      (_, i) => ratingOverrides?.[i] ?? rating(),
    );
    const filled = (list: readonly string[]) =>
      chance(rng, 0.8) ? pick(rng, list) : '';

    const steps: SessionStep[] = [
      {
        step: 1,
        seconds: stepSeconds[0],
        rating: ratings[0] ?? null,
        content: { learnerAnswer: chance(rng, 0.85) ? diagnosis : '' },
      },
      {
        step: 2,
        seconds: stepSeconds[1],
        rating: ratings[1] ?? null,
        content: { mode: chance(rng, 0.7) ? 'quick' : 'deep' },
      },
      {
        step: 3,
        seconds: stepSeconds[2],
        rating: ratings[2] ?? null,
        content: {
          points: [
            filled(TEACHING_POINTS),
            filled(TEACHING_POINTS),
            filled(TEACHING_POINTS),
            filled(TEACHING_POINTS),
            filled(TEACHING_POINTS),
          ],
        },
      },
      {
        step: 4,
        seconds: stepSeconds[3],
        rating: ratings[3] ?? null,
        content: {
          starters: [filled(STRENGTHS), filled(STRENGTHS), filled(STRENGTHS)],
          tags: STEP4_TAGS.filter(() => chance(rng, 0.25)),
        },
      },
      {
        step: 5,
        seconds: stepSeconds[4],
        rating: ratings[4] ?? null,
        content: {
          starters: [
            filled(IMPROVEMENTS),
            filled(IMPROVEMENTS),
            filled(IMPROVEMENTS),
          ],
          actionPlan: pick(rng, ACTION_PLANS),
        },
      },
    ];

    const startedAtMs =
      BASE_TIME +
      randomInt(rng, 0, 69) * DAY_MS +
      randomInt(rng, 0, 8 * 60) * 60 * 1000;
    const skippedLog = chance(rng, 0.1);

    return {
      id: randomUuid(rng),
      studentId: fields.studentId ?? randomUuid(rng),
      department: pick(rng, DEPARTMENTS),
      caseType: pick(rng, CASE_TYPES),
      learnerLevel: level,
      learnerYear: year,
      startedAt: new Date(startedAtMs).toISOString(),
      teachingSeconds,
      overtimeSeconds: overtimeFor(teachingSeconds),
      pausedSeconds: chance(rng, 0.7) ? 0 : randomInt(rng, 1, 40),
      logSeconds: randomInt(rng, 5, 90),
      diagnosis: skippedLog ? null : diagnosis,
      learnerGaveDiagnosis: skippedLog ? null : chance(rng, 0.6),
      usefulness: skippedLog
        ? null
        : (randomInt(rng, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6),
      appVersion: '1.0.0',
      steps,
      ...fields,
    };
  }

  function makePearl(overrides: PearlOverrides = {}): Pearl {
    return {
      id: randomUuid(rng),
      diagnosis: pick(rng, FIXTURE_DIAGNOSES),
      points: [
        pick(rng, TEACHING_POINTS),
        pick(rng, TEACHING_POINTS),
        pick(rng, TEACHING_POINTS),
        pick(rng, TEACHING_POINTS),
        pick(rng, TEACHING_POINTS),
      ],
      timesUsed: randomInt(rng, 0, 8),
      updatedAt: new Date(
        BASE_TIME + randomInt(rng, 0, 69) * DAY_MS,
      ).toISOString(),
      deleted: false,
      ...overrides,
    };
  }

  return {
    rng,
    uuid: () => randomUuid(rng),
    makeDoctor,
    makeStudent,
    makeStudentInput,
    makeSession,
    makePearl,
  };
}

export type Fixtures = ReturnType<typeof createFixtures>;
export * from './known.ts';
