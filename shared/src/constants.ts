// Fixed lists and limits shared by the app and the server. Nothing else defines these.

export const APP_NAME = 'OMP DigiCoach';

/** One countdown covers the whole session. At zero the app counts extra time. */
export const SESSION_SECONDS = 60;
/** A draft saved longer ago than this asks Resume or Discard. */
export const RESUME_PROMPT_AFTER_MS = 15 * 60 * 1000;
/** Upper limit for every stored second count: six hours. */
export const MAX_SECONDS = 21_600;

export const STEP_IDS = [1, 2, 3, 4, 5] as const;
export type StepId = (typeof STEP_IDS)[number];

/**
 * The steps the preceptor rates. Step 3, Teach General Rule, and step 5, Correct & Improve, take
 * remarks only, since the pilot feedback of 30 September 2026. Ratings stored for them before then
 * are kept, and left out of every average, chart and dashboard; the CSV export still has their
 * columns.
 */
export const RATED_STEP_IDS = [1, 2, 4] as const satisfies readonly StepId[];

export function isRatedStep(step: number): boolean {
  return (RATED_STEP_IDS as readonly number[]).includes(step);
}

/** The rated steps in words, such as "steps 1, 2 and 4". */
export function ratedStepsText(): string {
  const ids = [...RATED_STEP_IDS];
  const last = ids.pop();
  return `steps ${ids.join(', ')} and ${last}`;
}

export const STEP2_MODES = ['quick', 'deep'] as const;
export type Step2Mode = (typeof STEP2_MODES)[number];

export const STEP4_TAGS = [
  'Good reasoning',
  'Good history',
  'Good examination',
  'Good communication',
  'Thorough workup',
  'Good differential',
] as const;
export type Step4Tag = (typeof STEP4_TAGS)[number];

/** Step 3's five fill-in points. `label` reads in a sentence; `shortLabel` heads a saved pearl. */
export const STEP3_TEMPLATES = [
  {
    label: 'One important thing to remember is',
    shortLabel: 'Remember',
    placeholder: '___',
  },
  {
    label: 'In patients with',
    shortLabel: 'In patients with',
    placeholder: 'condition',
  },
  { label: 'always check', shortLabel: 'Always check', placeholder: 'what' },
  {
    label: 'First-line treatment is usually',
    shortLabel: 'Treatment',
    placeholder: '___',
  },
  { label: 'Warning sign', shortLabel: 'Warning sign', placeholder: '___' },
] as const;

export const STEPS = [
  {
    id: 1,
    name: 'Get a Commitment',
    instruction: 'Ask the learner to commit to a diagnosis or plan',
    prompts: [
      'What do you think is the most likely diagnosis?',
      'What do you think is going on?',
      'What would you like to do next?',
      'What is your management plan?',
    ],
  },
  {
    id: 2,
    name: 'Probe for Evidence',
    instruction: 'Explore the learner’s reasoning',
    quickPrompts: [
      'What findings support that diagnosis?',
      'What other diagnoses did you consider?',
      'Why did you rule out the alternatives?',
      'What investigation would you order?',
    ],
    deepPrompts: [
      'What findings support that diagnosis?',
      'What other diagnoses did you consider?',
      'Why did you rule out the alternatives?',
      'What investigation would you order?',
      'What are the risk factors?',
      'What is the pathophysiology?',
      'What complications do you anticipate?',
    ],
  },
  {
    id: 3,
    name: 'Teach General Rule',
    instruction: 'Teach 1–2 key points',
    templates: STEP3_TEMPLATES,
  },
  {
    id: 4,
    name: 'Reinforce Strengths',
    instruction: 'Provide positive feedback',
    starters: [
      'You did well in',
      'Good clinical reasoning because',
      'I liked how you',
    ],
    tags: STEP4_TAGS,
  },
  {
    id: 5,
    name: 'Correct & Improve',
    instruction: 'Guide improvement',
    starters: ['Next time, try to', 'You missed', 'Consider'],
  },
] as const;

/** The details of the rated steps, in order. */
export const RATED_STEPS = STEPS.filter((step) => isRatedStep(step.id));

/** The values for the rated steps, from a list with one value per step. */
export function ratedValues<T>(perStep: readonly T[]): T[] {
  return RATED_STEP_IDS.map((id) => perStep[id - 1] as T);
}

/** Index 0 is one star. */
export const RATING_LABELS = [
  'Needs improvement',
  'Basic',
  'Competent',
  'Proficient',
  'Excellent',
] as const;
export type Rating = 1 | 2 | 3 | 4 | 5;

export function ratingLabel(rating: Rating): string {
  return RATING_LABELS[rating - 1] as string;
}

export const USEFULNESS_MAX = 6;
/** The quick log's question: the preceptor asks the student. The stored field is `usefulness`. */
export const USEFULNESS_QUESTION =
  'Ask the student: How useful was this session for you?';
/** The student's answer, where it is shown later. */
export const USEFULNESS_LABEL = 'Useful for the student';

export const LEVELS = ['medical_student', 'house_officer', 'resident'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<Level, string> = {
  medical_student: 'Medical Student',
  house_officer: 'House Officer (HO)',
  resident: 'Resident',
};

/** Only medical students have a year. */
export const YEARS = ['1st', '2nd', '3rd', '4th', 'final'] as const;
export type Year = (typeof YEARS)[number];
export const YEAR_LABELS: Record<Year, string> = {
  '1st': '1st Year',
  '2nd': '2nd Year',
  '3rd': '3rd Year',
  '4th': '4th Year',
  final: 'Final Year',
};

export const CASE_TYPES = [
  'long_case',
  'short_case',
  'case_based_discussion',
  'procedure',
  'counseling',
  'other',
] as const;
export type CaseType = (typeof CASE_TYPES)[number];
export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  long_case: 'Long Case',
  short_case: 'Short Case',
  case_based_discussion: 'Case Based Discussion',
  procedure: 'Procedure',
  counseling: 'Counseling',
  other: 'Other',
};

export const DEPARTMENTS = [
  'medicine',
  'surgery',
  'pediatrics',
  'gynecology_obstetrics',
  'psychiatry',
  'ent',
  'ophthalmology',
  'dermatology',
  'orthopedics',
  'emergency',
  'other',
] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const DEPARTMENT_LABELS: Record<Department, string> = {
  medicine: 'Medicine',
  surgery: 'Surgery',
  pediatrics: 'Pediatrics',
  gynecology_obstetrics: 'Gynecology / Obstetrics',
  psychiatry: 'Psychiatry',
  ent: 'ENT',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  orthopedics: 'Orthopedics',
  emergency: 'Emergency',
  other: 'Other',
};

export const DESIGNATIONS = [
  'professor',
  'associate_professor',
  'assistant_professor',
  'consultant',
  'senior_registrar',
  'registrar',
  'senior_resident',
  'medical_officer',
  'other',
] as const;
export type Designation = (typeof DESIGNATIONS)[number];
export const DESIGNATION_LABELS: Record<Designation, string> = {
  professor: 'Professor',
  associate_professor: 'Associate Professor',
  assistant_professor: 'Assistant Professor',
  consultant: 'Consultant',
  senior_registrar: 'Senior Registrar',
  registrar: 'Registrar',
  senior_resident: 'Senior Resident',
  medical_officer: 'Medical Officer',
  other: 'Other',
};

export const LIMITS = {
  nameMin: 2,
  nameMax: 100,
  pmdcMin: 3,
  pmdcMax: 20,
  usernameMin: 3,
  usernameMax: 30,
  diagnosisMax: 200,
  stepTextMax: 500,
  actionPlanMax: 1000,
  passwordMin: 6,
  passwordMax: 128,
  appVersionMax: 50,
} as const;

/** Stored upper-case: letters, digits or hyphens. */
export const PMDC_PATTERN = /^[A-Z0-9-]{3,20}$/;
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export const PUSH_BATCH_MAX = 50;
export const ADMIN_PAGE_SIZE = 50;

/** Dates on the dashboard, in reports and in the CSV use Pakistan time. */
export const REPORT_TIME_ZONE = 'Asia/Karachi';
