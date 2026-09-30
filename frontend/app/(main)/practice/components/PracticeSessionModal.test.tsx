import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeSessionModal from '@/app/(main)/practice/components/PracticeSessionModal';
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
    switchTo: vi.fn(),
    correct: vi.fn(),
    isStarting: false,
    isStopping: false,
    isSwitching: false,
    isToggling: false,
  },
}));

const notes = vi.hoisted(() => ({
  saveNote: vi.fn(async () => ({})),
  saveSessionNote: vi.fn(async () => ({})),
  logTime: vi.fn(async () => ({})),
}));

vi.mock('@/app/(main)/practice/hooks/usePracticeSession', () => ({
  useActiveSession: () => session.current,
  usePracticeNotes: () => notes,
}));

// "Switch to" offers the subject's top of mind, read from the task list.
const allTasks = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock('@/app/(main)/(todo)/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: allTasks.current }),
  TASKS_ROOT: ['tasks'],
}));

// The ready state is the piece's popover, which reads the piece's past logs for
// its "last time" line.
const pieceLogs = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock('@/app/(main)/practice/hooks/usePracticeLogs', () => ({
  usePracticeLogs: () => ({ logs: pieceLogs.current }),
}));

const readyMaterial = vi.hoisted(() => ({ current: null as Task | null }));
// Stable across renders, so `dismiss` can be asserted on — a fresh `vi.fn()` per
// render would also make the component's effect dependency churn every time.
const ui = vi.hoisted(() => ({ openFor: vi.fn(), dismiss: vi.fn() }));

vi.mock('@/app/contexts/PracticeSessionContext', async () => {
  const actual = await vi.importActual<typeof import('@/app/contexts/PracticeSessionContext')>(
    '@/app/contexts/PracticeSessionContext'
  );
  return {
    ...actual,
    usePracticeSessionUI: () => ({
      readyMaterial: readyMaterial.current,
      openFor: ui.openFor,
      dismiss: ui.dismiss,
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
  pieceLogs.current = [];
  allTasks.current = [];
  notes.saveNote.mockClear();
  notes.saveSessionNote.mockClear();
  notes.logTime.mockClear();
  ui.openFor.mockClear();
  ui.dismiss.mockClear();
  session.current = {
    ...session.current,
    session: null,
    segments: [],
    running: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    switchTo: vi.fn(),
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

describe('ready state: the piece popover', () => {
  it('names the piece, and starts the timer', async () => {
    readyMaterial.current = material;
    renderModal();

    expect(screen.getByRole('heading', { name: 'bach invention 4' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    expect(session.current.start).toHaveBeenCalledWith('material-1');
  });

  it("shows the details a piece has, and none it doesn't", () => {
    readyMaterial.current = {
      ...material,
      materialCategory: 'songs',
      tempo: 140,
      goalTempo: 160,
      link: 'https://www.songsterr.com/a/wsa/reversal',
    } as unknown as Task;
    pieceLogs.current = [
      { documentId: 'open', date: '2026-08-14', duration: 0, stop: null },
      { documentId: 'last', date: '2026-08-11', duration: 20, stop: '2026-08-11T15:20:00.000Z' },
    ];
    renderModal();

    // No subject or category line: the list it was opened from says both.
    expect(screen.queryByText(/guitar/)).toBeNull();
    expect(screen.getByText('140 bpm, goal 160')).toBeDefined();
    expect(screen.getByRole('link', { name: /songsterr\.com/ }).getAttribute('href')).toBe(
      'https://www.songsterr.com/a/wsa/reversal'
    );
    // The open log isn't a finished session; the last finished one is.
    expect(screen.getByText('3 days ago, 20 min')).toBeDefined();
    expect(screen.queryByText('note')).toBeNull();
  });

  it('logs time done without the timer, for the day picked', async () => {
    readyMaterial.current = { ...material, tempo: 140, goalTempo: 160 } as unknown as Task;
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /log time/i }));
    expect(screen.getByRole('heading', { name: 'bach invention 4' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('day'), { target: { value: 'yesterday' } });
    fireEvent.change(screen.getByLabelText('minutes'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('tempo reached'), { target: { value: '144' } });
    fireEvent.change(screen.getByLabelText('note'), { target: { value: "at a friend's" } });
    fireEvent.click(screen.getByRole('button', { name: 'log it' }));

    await vi.waitFor(() =>
      expect(notes.logTime).toHaveBeenCalledWith({
        material: 'material-1',
        date: '2026-08-13',
        minutes: 20,
        tempoReached: 144,
        notes: "at a friend's",
      })
    );
    await vi.waitFor(() => expect(ui.dismiss).toHaveBeenCalled());
  });

  it('won\'t log time without minutes', () => {
    readyMaterial.current = material;
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /log time/i }));
    expect(screen.queryByLabelText('tempo reached')).toBeNull(); // no tempo on this piece
    fireEvent.click(screen.getByRole('button', { name: 'log it' }));
    expect(notes.logTime).not.toHaveBeenCalled();
    expect(screen.getByText('how many minutes?')).toBeDefined();
  });

  it('closes from the corner rather than a button at the foot of the panel', () => {
    readyMaterial.current = material;
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(ui.dismiss).toHaveBeenCalled();
  });

  it('closes on Escape, since nothing is running yet', () => {
    readyMaterial.current = material;
    renderModal();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(ui.dismiss).toHaveBeenCalled();
  });

  it('stays on screen while the start is in flight', () => {
    // The regression: pressing play used to `dismiss()` synchronously, clearing
    // the offer while the POST was still going. For the length of the round trip
    // there was neither an offer nor a session, so the modal unmounted and the
    // page flashed through behind it. The offer is now released by an effect,
    // once there is a session to replace it with.
    readyMaterial.current = material;
    session.current = { ...session.current, isStarting: true };
    renderModal();

    expect(screen.getByRole('dialog', { name: 'bach invention 4' })).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /start timer/i }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(ui.dismiss).not.toHaveBeenCalled();
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

    expect(screen.getByRole('dialog', { name: 'practicing' })).toBeDefined();
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

  it('ignores Escape', () => {
    renderModal();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'practicing' })).toBeDefined();
    expect(ui.dismiss).not.toHaveBeenCalled();
  });

  it('does not offer to correct a session that has just started', () => {
    renderModal();
    expect(screen.queryByText(/you left this running/i)).toBeNull();
  });

  it('releases the offer once the session it was for exists', () => {
    // The other half of the no-flash fix: the offer is dropped here rather than
    // on click, and the running panel takes over in the same paint.
    readyMaterial.current = material;
    renderModal();

    expect(screen.getByRole('dialog', { name: 'practicing' })).toBeDefined();
    expect(ui.dismiss).toHaveBeenCalled();
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
    const button = screen.getByRole('button', { name: /resume practicing bach invention 4/i });
    expect(button.textContent).toContain('20:00');

    fireEvent.click(button);
    expect(session.current.resume).toHaveBeenCalled();
  });
});

describe('switching pieces and stopping', () => {
  const guitar = { documentId: 'subject-1', title: 'guitar' };
  const piece = (documentId: string, title: string, over: Record<string, unknown> = {}) =>
    ({ documentId, title, project: guitar, soon: true, onHold: false, completed: false, ...over }) as unknown as Task;

  beforeEach(() => {
    session.current = {
      ...session.current,
      session: {
        documentId: 'log-2',
        material: { ...material, tempo: 140, goalTempo: 160 },
        session: {
          documentId: 'sitting-1',
          subject: guitar,
          practice_logs: [
            { documentId: 'log-1', start: '2026-08-14T14:30:00.000Z', stop: '2026-08-14T14:36:00.000Z', duration: 6, segments: [{ start: '2026-08-14T14:30:00.000Z', stop: '2026-08-14T14:36:00.000Z' }], material: { documentId: 'dyad', title: 'dyad exercise' } },
            { documentId: 'log-2', start: '2026-08-14T14:36:00.000Z', stop: null, duration: 0, material: { documentId: 'material-1', title: 'bach invention 4' } },
          ],
        },
      },
      segments: [{ start: '2026-08-14T14:36:00.000Z', stop: null }],
      running: true,
    };
    allTasks.current = [
      piece('material-1', 'bach invention 4'),
      piece('dyad', 'dyad exercise'),
      piece('shelf', 'scales', { soon: false }),
      piece('held', 'sight reading', { onHold: true }),
      piece('other', 'intervals', { project: { documentId: 'subject-2', title: 'ear training' } }),
    ];
  });

  it("the clock is the whole session's, with this piece's time under it", () => {
    renderModal();
    const [total, piece] = screen.getAllByRole('timer').map((t) => t.textContent);
    expect(total).toBe('30:00'); // 6 on the dyad exercise + 24 on this piece
    expect(piece).toBe('24:00');
  });

  it("offers the subject's top of mind, minus the piece playing, with its minutes so far", () => {
    renderModal();
    const offered = screen.getAllByRole('button').filter((b) => !b.getAttribute('aria-label'));
    expect(offered.map((b) => b.textContent)).toEqual(['dyad exercise6 min']);
  });

  it('switching asks for a note on the piece left, with its tempo', async () => {
    session.current.switchTo = vi.fn(async () => ({
      data: { documentId: 'log-3' },
      closed: { documentId: 'log-2', duration: 18 },
    }));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /dyad exercise/ }));
    expect(session.current.switchTo).toHaveBeenCalledWith('dyad');

    expect(await screen.findByRole('dialog', { name: 'bach invention 4' })).toBeDefined();
    expect(screen.getByText('18 min')).toBeDefined();
    expect((screen.getByLabelText('tempo reached') as HTMLInputElement).value).toBe('140');
    expect(screen.getByText('next: dyad exercise')).toBeDefined();

    fireEvent.change(screen.getByLabelText('note'), { target: { value: 'turnaround rushes' } });
    fireEvent.change(screen.getByLabelText('tempo reached'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'save and switch' }));
    await vi.waitFor(() =>
      expect(notes.saveNote).toHaveBeenCalledWith('log-2', { notes: 'turnaround rushes', tempoReached: 150 })
    );
  });

  it('after stop, a note on the last piece and one on the whole session', async () => {
    session.current.stop = vi.fn(async () => ({ documentId: 'log-2', duration: 18 }));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    expect(await screen.findByRole('dialog', { name: '24 minutes' })).toBeDefined();
    expect(screen.getByText('dyad exercise')).toBeDefined();

    fireEvent.change(screen.getByLabelText('note on the whole session'), {
      target: { value: 'short on sleep' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await vi.waitFor(() =>
      expect(notes.saveSessionNote).toHaveBeenCalledWith('sitting-1', 'short on sleep')
    );
  });

  it('skipping saves nothing', async () => {
    session.current.stop = vi.fn(async () => ({ documentId: 'log-2', duration: 18 }));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    fireEvent.click(await screen.findByRole('button', { name: 'skip' }));
    expect(notes.saveNote).not.toHaveBeenCalled();
    expect(notes.saveSessionNote).not.toHaveBeenCalled();
  });
});
