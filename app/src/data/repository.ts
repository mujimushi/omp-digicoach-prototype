import type {
  Pearl,
  PushItemType,
  PushRejectCode,
  SessionDraft,
  Student,
  StudentInput,
  TeachingSession,
} from '@omp/shared';

/** A pearl as the doctor writes it. The repository sets the use count, time and deleted flag. */
export type PearlInput = Pick<Pearl, 'id' | 'diagnosis' | 'points'>;

export type SessionFilter = {
  studentId?: string;
};

/** An item the server refused for good. The doctor sees it under More. */
export type NeedsAttentionItem = {
  opId: string;
  type: PushItemType;
  code: PushRejectCode;
  /** What the item was, in words the doctor recognises, such as a student's name. */
  summary: string;
  failedAt: string;
};

/**
 * Storage on the phone. The doctor screens use only this interface: they never call `fetch` or
 * open IndexedDB themselves.
 *
 * Every saving method stores the record and queues it for the server in one step, so a record is
 * never stored without being queued, or queued without being stored.
 */
export interface Repository {
  // Students: the shared list, sorted by name.
  listStudents(search?: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student | undefined>;
  saveStudent(input: StudentInput): Promise<Student>;

  // The session in progress.
  loadDraft(): Promise<SessionDraft | undefined>;
  saveDraft(draft: SessionDraft): Promise<void>;
  discardDraft(): Promise<void>;
  /** Stores the finished session, queues it and discards the draft, all in one step. */
  completeSession(session: TeachingSession): Promise<void>;

  // This doctor's own sessions, newest first.
  listMySessions(filter?: SessionFilter): Promise<TeachingSession[]>;
  getMySession(id: string): Promise<TeachingSession | undefined>;

  // This doctor's own pearls, without deleted ones, sorted by diagnosis.
  listMyPearls(): Promise<Pearl[]>;
  findPearlForAnswer(text: string): Promise<Pearl | undefined>;
  savePearl(pearl: PearlInput): Promise<Pearl>;
  deletePearl(id: string): Promise<void>;
  markPearlUsed(id: string): Promise<void>;

  // Sync state.
  /** Calls `listener` with the number of items waiting to send, now and on every change. Returns an unsubscribe function. */
  subscribeWaitingCount(listener: (count: number) => void): () => void;
  listNeedsAttention(): Promise<NeedsAttentionItem[]>;
}
