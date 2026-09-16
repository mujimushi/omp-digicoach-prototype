import type {
  DoctorActivityRow,
  DoctorDetail,
  OverviewStats,
  PublicUser,
  RatingSpread,
  SessionDetail,
  SessionListRow,
  Student,
  StudentDetail,
  StudentSummaryRow,
  TeachingSession,
} from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';

/** Fixed records the mock handlers answer with. Tests may read them. */
const fixtures = createFixtures(314);

const admin: PublicUser = {
  ...fixtures.makeDoctor({ name: 'Admin Mock', username: 'admin.mock' }),
  department: null,
  designation: null,
  isDoctor: false,
  isAdmin: true,
};
const doctor = fixtures.makeDoctor({ username: 'doctor.mock' });
const secondDoctor = fixtures.makeDoctor({ username: 'doctor.two.mock' });

const students: Student[] = Array.from({ length: 8 }, () =>
  fixtures.makeStudent(),
);

const sessions: { doctorId: string; session: TeachingSession }[] =
  students.flatMap((student, i) =>
    [doctor, secondDoctor].slice(0, (i % 2) + 1).map((teacher) => ({
      doctorId: teacher.id,
      session: fixtures.makeSession({
        studentId: student.id,
        learnerLevel: student.level,
        learnerYear: student.year,
      }),
    })),
  );

const pearls = [
  fixtures.makePearl({ diagnosis: 'Pneumonia' }),
  fixtures.makePearl({ diagnosis: 'Acute asthma' }),
];

function listRow(entry: {
  doctorId: string;
  session: TeachingSession;
}): SessionListRow {
  const { session } = entry;
  const teacher = entry.doctorId === doctor.id ? doctor : secondDoctor;
  const student = students.find((s) => s.id === session.studentId);
  return {
    id: session.id,
    startedAt: session.startedAt,
    doctorId: teacher.id,
    doctorName: teacher.name,
    studentId: session.studentId,
    studentName: student?.name ?? 'Unknown',
    pmdcNumber: student?.pmdcNumber ?? null,
    department: session.department,
    caseType: session.caseType,
    learnerLevel: session.learnerLevel,
    learnerYear: session.learnerYear,
    teachingSeconds: session.teachingSeconds,
    overtimeSeconds: session.overtimeSeconds,
    pausedSeconds: session.pausedSeconds,
    diagnosis: session.diagnosis,
    usefulness: session.usefulness,
    ratings: session.steps.map((s) => s.rating) as SessionListRow['ratings'],
  };
}

function activity(user: PublicUser): DoctorActivityRow {
  const own = sessions.filter((entry) => entry.doctorId === user.id);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    department: user.department,
    designation: user.designation,
    isDoctor: user.isDoctor,
    isAdmin: user.isAdmin,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    sessionsTotal: own.length,
    sessionsLast7Days: Math.min(own.length, 2),
    lastSessionAt: own[0]?.session.startedAt ?? null,
    avgTeachingSeconds: own.length ? 95 : null,
    avgOvertimeSeconds: own.length ? 35 : null,
    allStepsRatedShare: own.length ? 0.5 : null,
    studentsTaught: new Set(own.map((e) => e.session.studentId)).size,
    lastLoginAt: '2026-09-15T05:00:00.000Z',
  };
}

const emptySpread = () => ({
  counts: [1, 2, 3, 2, 1] as [number, number, number, number, number],
  unrated: 1,
});
const ratingSpread: RatingSpread = [
  emptySpread(),
  emptySpread(),
  emptySpread(),
  emptySpread(),
  emptySpread(),
];

function summary(student: Student): StudentSummaryRow {
  const own = sessions.filter((e) => e.session.studentId === student.id);
  return {
    id: student.id,
    name: student.name,
    pmdcNumber: student.pmdcNumber,
    level: student.level,
    year: student.year,
    sessions: own.length,
    doctors: new Set(own.map((e) => e.doctorId)).size,
    avgRatingPerStep: [3, 3.5, null, 4, 2],
    lastSessionAt: own[0]?.session.startedAt ?? null,
  };
}

export const mockData = {
  admin,
  doctor,
  secondDoctor,
  students,
  sessions,
  pearls,
  temporaryPassword: 'k7mq-3xrp-9dwt-2hvf',

  overview(): OverviewStats {
    return {
      activeDoctors: 2,
      sessionsThisWeek: 3,
      students: students.length,
      avgTeachingSecondsThisMonth: 92.5,
      avgOvertimeSecondsThisMonth: 33,
      avgRatingPerStepThisMonth: [3.2, 3.4, 3.1, null, 2.9],
      sessionsPerWeek: Array.from({ length: 12 }, (_, i) => ({
        weekStart: new Date(Date.UTC(2026, 5, 22 + i * 7))
          .toISOString()
          .slice(0, 10),
        sessions: (i * 3) % 7,
      })),
    };
  },

  doctors(): DoctorActivityRow[] {
    return [admin, doctor, secondDoctor].map(activity);
  },

  doctorDetail(id: string): DoctorDetail | undefined {
    const user = [admin, doctor, secondDoctor].find((u) => u.id === id);
    if (!user) return undefined;
    const own = sessions.filter((e) => e.doctorId === id);
    return {
      activity: activity(user),
      sessions: own.map(listRow),
      students: students
        .filter((s) => own.some((e) => e.session.studentId === s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          pmdcNumber: s.pmdcNumber,
          level: s.level,
          year: s.year,
          sessions: own.filter((e) => e.session.studentId === s.id).length,
          lastSessionAt: own[0]?.session.startedAt ?? s.createdAt,
        })),
      ratingSpread,
    };
  },

  studentRows(): StudentSummaryRow[] {
    return students.map(summary);
  },

  studentDetail(id: string): StudentDetail | undefined {
    const student = students.find((s) => s.id === id);
    if (!student) return undefined;
    const own = sessions.filter((e) => e.session.studentId === id);
    return {
      student,
      summary: summary(student),
      sessions: own.map(listRow),
      ratingsOverTime: own.map((e) => ({
        sessionId: e.session.id,
        startedAt: e.session.startedAt,
        ratings: listRow(e).ratings,
      })),
      changes: [],
    };
  },

  sessionRows(): SessionListRow[] {
    return sessions.map(listRow);
  },

  sessionDetail(id: string): SessionDetail | undefined {
    const entry = sessions.find((e) => e.session.id === id);
    if (!entry) return undefined;
    const teacher = entry.doctorId === doctor.id ? doctor : secondDoctor;
    const student = students.find((s) => s.id === entry.session.studentId);
    return {
      session: entry.session,
      doctor: {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
      },
      student: {
        id: entry.session.studentId,
        name: student?.name ?? 'Unknown',
        pmdcNumber: student?.pmdcNumber ?? null,
      },
      receivedAt: entry.session.startedAt,
    };
  },
};
