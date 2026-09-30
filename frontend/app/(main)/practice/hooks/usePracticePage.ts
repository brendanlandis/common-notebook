'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/app/lib/apiFetch';
import { useProjects } from '@/app/hooks/useProjects';
import { isPracticeWorld } from '@/app/lib/worlds';
import type { PracticeSession, Project, Task } from '@/app/types/index';

const LAST_SUBJECT_KEY = 'practice-subject';

/** Another tab picking a subject is a change here too. */
function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readLastSubject(): string | null {
  try {
    return window.localStorage.getItem(LAST_SUBJECT_KEY);
  } catch {
    return null;
  }
}

/**
 * Which subject the practice page shows, shared by the header's dropdown and the
 * page: `?subject=<slug>`, else the one last picked on this device, else the
 * first. The address is the source of truth, so a subject can be linked to and
 * the back button steps between subjects.
 */
export function usePracticeSubject() {
  const { projects } = useProjects();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const subjects = useMemo(
    () =>
      projects
        .filter((p) => isPracticeWorld(p.world) && !p.complete)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [projects],
  );

  // localStorage as an external store: nothing on the server, the stored choice
  // once hydrated, so the two renders agree.
  const last = useSyncExternalStore(subscribeToStorage, readLastSubject, () => null);

  const slugOf = (p: Project) => p.slug ?? p.documentId;
  const wanted = params.get('subject') ?? last;
  const subject: Project | null =
    subjects.find((s) => slugOf(s) === wanted) ?? subjects[0] ?? null;

  const choose = useCallback(
    (slug: string) => {
      try {
        window.localStorage.setItem(LAST_SUBJECT_KEY, slug);
      } catch {
        // A private window: the choice just isn't remembered.
      }
      router.replace(`${pathname}?subject=${encodeURIComponent(slug)}`);
    },
    [router, pathname],
  );

  return { subjects, subject, choose, slugOf };
}

/** Practice sessions since `since`, for their whole-session notes. */
export function usePracticeSessions(since: string) {
  const query = useQuery({
    queryKey: ['practice-sessions', since],
    queryFn: () =>
      apiFetch<{ success?: boolean; data?: PracticeSession[] }>(`/api/practice-sessions?since=${since}`),
    select: (body) => body.data ?? [],
  });
  return query.data ?? [];
}

/** A subject's learned pieces, however long ago. */
export function useLearnedPieces(subject: string | null) {
  const query = useQuery({
    queryKey: ['tasks', 'learned', subject],
    enabled: Boolean(subject),
    queryFn: () =>
      apiFetch<{ success?: boolean; data?: Task[] }>(`/api/practice/learned?subject=${encodeURIComponent(subject!)}`),
    select: (body) => body.data ?? [],
  });
  return query.data ?? [];
}
