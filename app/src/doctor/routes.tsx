import type { RouteObject } from 'react-router';
import { AboutScreen } from './about/AboutScreen.tsx';
import { HistoryScreen } from './history/HistoryScreen.tsx';
import { SessionDetailScreen } from './history/SessionDetailScreen.tsx';
import { MoreScreen } from './more/MoreScreen.tsx';
import { PearlLibraryScreen } from './pearls/PearlLibraryScreen.tsx';
import { ProgressScreen } from './progress/ProgressScreen.tsx';
import { StudentProgressScreen } from './progress/StudentProgressScreen.tsx';
import { QuickLogScreen } from './session/QuickLogScreen.tsx';
import { SessionScreen } from './session/SessionScreen.tsx';
import { SessionSetupScreen } from './session/SessionSetupScreen.tsx';
import { StatsScreen } from './stats/StatsScreen.tsx';
import { StudentFormScreen } from './students/StudentFormScreen.tsx';
import { StudentListScreen } from './students/StudentListScreen.tsx';

/** The doctor app's pages, under `/`. */
export const doctorRoutes: RouteObject[] = [
  { index: true, Component: StudentListScreen },
  { path: 'students/new', Component: StudentFormScreen },
  { path: 'students/:id/edit', Component: StudentFormScreen },
  { path: 'session/setup', Component: SessionSetupScreen },
  { path: 'session', Component: SessionScreen },
  { path: 'session/log', Component: QuickLogScreen },
  { path: 'history', Component: HistoryScreen },
  { path: 'history/:id', Component: SessionDetailScreen },
  { path: 'stats', Component: StatsScreen },
  { path: 'progress', Component: ProgressScreen },
  { path: 'progress/:studentId', Component: StudentProgressScreen },
  { path: 'more', Component: MoreScreen },
  { path: 'pearls', Component: PearlLibraryScreen },
  { path: 'about', Component: AboutScreen },
];
