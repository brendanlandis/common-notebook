import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeSessionModal from './PracticeSessionModal';
import { PracticeSessionProvider } from '@/app/contexts/PracticeSessionContext';
import { DateTimeSettingsProvider } from '@/app/contexts/DateTimeSettingsContext';
import type { Task } from '@/app/types/index';

/**
 * The modal's three states, and the one rule that matters: **pause is the only
 * way out of full screen.** Everything else here is a consequence of that.
 *
 * `useActiveSession` is mocked rather than exercised — this is about what the
 * component renders for a given session, and the hook has its own coverage in
 * the route tests. There is no global fetch mock in this suite, so an unmocked
 * query would hit a real relative URL.
 */
const session = vi.hoisted(() => ({
  current: {
    session: null as unknown,
    segments: [] as unknown[],
    running: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    correct: vi.fn(),
    isStarting: false,
    isStopping: false,
    isToggling: false,
  },
}));

vi.mock('@/app/hooks/usePracticeSession', () => ({
  useActiveSession: () => session.current,
}));

const readyMaterial = vi.hoisted(() => ({ current: null as Task | null }));

vi.mock('@/app/contexts/PracticeSessionContext', async () => {
  const actual = await vi.importActual<typeof import('@/app/contexts/PracticeSessionContext')>(
    '@/app/contexts/PracticeSessionContext'
  );
  return {
    ...actual,
    usePracticeSessionUI: () => ({
      readyMaterial: readyMaterial.current,
      openFor: vi.fn(),
      dismiss: vi.fn(),
    }),
  };
});

const material = {
  documentId: 'material-1',
  title: 'bach invention 4',
  project: { documentId: 'subject-1', title: 'guitar' },
} as unknown as Task;

function renderModal() {
  return render(
    <DateTimeSettingsProvider
      initial={{
        timeZoneSettings: { timezone: 'America/New_York', dayBoundaryHour: 4 },
        completedTaskVisibilityMinutes: 15,
      }}
    >
      <PracticeSessionProvider>
        <PracticeSessionModal />
      </PracticeSessionProvider>
    </DateTimeSettingsProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));
  readyMaterial.current = null;
  session.current = {
    ...session.current,
    session: null,
    segments: [],
    running: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    correct: vi.fn(),
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nothing running', () => {
  it('renders nothing at all', () => {
    const { container } = renderModal();
    expect(container.firstChild).toBeNull();
  });
});

describe('ready state', () => {
  it('names the material and its subject, and offers play', async () => {
    readyMaterial.current = material;
    renderModal();

    expect(screen.getByRole('heading', { name: 'bach invention 4' })).toBeDefined();
    expect(screen.getByText('guitar')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: /start practising bach invention 4/i })
    );
    expect(session.current.start).toHaveBeenCalledWith('material-1');
  });
});

describe('running', () => {
  beforeEach(() => {
    session.current = {
      ...session.current,
      session: { documentId: 'log-1', material },
      segments: [{ start: '2026-08-14T14:40:00.000Z', stop: null }],
      running: true,
    };
  });

  it('covers the page with the clock and two controls', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'practising' })).toBeDefined();
    expect(screen.getByRole('timer').textContent).toBe('20:00');
    expect(screen.getByRole('button', { name: 'pause' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'stop' })).toBeDefined();
  });

  it('offers no way out but pause and stop', () => {
    // The rule the whole design rests on. A "hide but keep running" control
    // would reintroduce exactly the forgetting the modal exists to prevent, so
    // its absence is worth asserting rather than leaving to good intentions.
    renderModal();
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['pause', 'stop']);
  });

  it('does not offer to correct a session that has just started', () => {
    renderModal();
    expect(screen.queryByText(/you left this running/i)).toBeNull();
  });
});

describe('stale session', () => {
  it('offers to correct one that has run more than four hours', async () => {
    session.current = {
      ...session.current,
      session: { documentId: 'log-1', material },
      segments: [{ start: '2026-08-14T09:00:00.000Z', stop: null }], // six hours
      running: true,
    };
    renderModal();

    expect(screen.getByText(/you left this running/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '60 min' }));
    expect(session.current.correct).toHaveBeenCalledWith(60);
  });

  it('still shows the real clock, because sometimes it really was that long', () => {
    session.current = {
      ...session.current,
      session: { documentId: 'log-1', material },
      segments: [{ start: '2026-08-14T09:00:00.000Z', stop: null }],
      running: true,
    };
    renderModal();
    expect(screen.getByRole('timer').textContent).toBe('6:00:00');
  });
});

describe('paused', () => {
  beforeEach(() => {
    session.current = {
      ...session.current,
      session: { documentId: 'log-1', material },
      segments: [{ start: '2026-08-14T14:00:00.000Z', stop: '2026-08-14T14:20:00.000Z' }],
      running: false,
    };
  });

  it('collapses to a single button that resumes', async () => {
    renderModal();

    expect(screen.queryByRole('dialog')).toBeNull();
    const button = screen.getByRole('button', { name: /resume practising bach invention 4/i });
    expect(button.textContent).toContain('20:00');

    fireEvent.click(button);
    expect(session.current.resume).toHaveBeenCalled();
  });
});
