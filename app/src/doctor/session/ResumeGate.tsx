import type { SessionDraft } from '@omp/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { formatTime } from '../format.ts';
import { shouldPromptResume } from '../timer/timer.ts';

/**
 * On app start, a session left open resumes straight away. One last saved more than 15 minutes ago
 * asks first: "Resume the session with [student] from [time]?"
 */
export function ResumeGate({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const checked = useRef(false);
  const [prompt, setPrompt] = useState<{
    draft: SessionDraft;
    studentName: string;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the doctor app opens
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    void (async () => {
      const draft = await repository.loadDraft();
      if (!draft) return;
      if (shouldPromptResume(draft, Date.now())) {
        const student = await repository.getStudent(draft.studentId);
        setPrompt({ draft, studentName: student?.name ?? 'your student' });
        return;
      }
      const target = draft.stage === 'log' ? '/session/log' : '/session';
      if (pathname !== target) navigate(target, { replace: true });
    })();
  }, []);

  return (
    <>
      {children}
      <ConfirmDialog
        open={prompt !== null}
        tone="primary"
        closeOnEscape={false}
        title={
          prompt
            ? `Resume the session with ${prompt.studentName} from ${formatTime(prompt.draft.timer.startedAtMs)}?`
            : ''
        }
        confirmLabel="Resume"
        cancelLabel="Discard"
        onCancel={() => {
          setPrompt(null);
          void repository.discardDraft();
        }}
        onConfirm={() => {
          if (!prompt) return;
          setPrompt(null);
          navigate(prompt.draft.stage === 'log' ? '/session/log' : '/session', {
            replace: true,
          });
        }}
      >
        Resuming keeps the time that has passed since then.
      </ConfirmDialog>
    </>
  );
}
