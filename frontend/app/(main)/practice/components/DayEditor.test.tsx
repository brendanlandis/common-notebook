import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PracticeLog, PracticeSession } from '@/app/types/index';

/**
 * The day editor's contract is which writes it makes: minutes through the
 * correction intent, notes and tempo on the stretch alone, the session's notes on
 * the session — and only for what changed.
 */

const guitar = { documentId: 'guitar', title: 'guitar' };
const para = (text: string) => [{ type: 'paragraph', children: [{ type: 'text', text }] }];

const data = vi.hoisted(() => ({ logs: [] as unknown[], sessions: [] as unknown[] }));
vi.mock('@/app/(main)/practice/hooks/usePracticeLogs', () => ({
  usePracticeLogs: () => ({ logs: data.logs }),
}));
vi.mock('@/app/(main)/practice/hooks/usePracticePage', () => ({
  usePracticeSessions: () => data.sessions,
}));

const apiSend = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock('@/app/lib/apiFetch', () => ({ apiSend }));

import DayEditor from './DayEditor';

const stretch = (over: Record<string, unknown>) =>
  ({
    date: '2026-09-30',
    stop: '2026-09-30T16:00:00Z',
    notes: [],
    tempoReached: null,
    session: { documentId: 'sitting' },
    ...over,
  }) as unknown as PracticeLog;

function renderEditor() {
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DayEditor date="2026-09-30" onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

beforeEach(() => {
  apiSend.mockClear();
  data.logs = [
    stretch({
      documentId: 'l1',
      start: '2026-09-30T15:00:00Z',
      duration: 6,
      notes: para('second shape buzzes'),
      material: { documentId: 'dyad', title: 'dyad exercise', project: guitar },
    }),
    stretch({
      documentId: 'l2',
      start: '2026-09-30T15:06:00Z',
      duration: 18,
      tempoReached: 140,
      material: { documentId: 'rev', title: 'Receive - Reversal', tempo: 140, project: guitar },
    }),
    stretch({ documentId: 'other-day', date: '2026-09-29', duration: 30, material: { title: 'x', project: guitar } }),
  ];
  data.sessions = [{ documentId: 'sitting', date: '2026-09-30', notes: 'short on sleep', subject: guitar }] as PracticeSession[];
});

describe('DayEditor', () => {
  it("shows the day's session with its notes, and each piece's minutes, tempo and note", () => {
    renderEditor();
    expect(screen.getByRole('heading', { name: 'guitar · 24 min' })).toBeTruthy();
    expect((screen.getByLabelText('note on the whole session') as HTMLTextAreaElement).value).toBe('short on sleep');
    expect(screen.getAllByLabelText('minutes').map((i) => (i as HTMLInputElement).value)).toEqual(['6', '18']);
    // Tempo reached only for the piece that has a tempo.
    expect(screen.getAllByLabelText('tempo reached')).toHaveLength(1);
    expect(screen.getByDisplayValue('second shape buzzes')).toBeTruthy();
    expect(screen.queryByText('x')).toBeNull();
  });

  it('saves only what changed, each through its own write', async () => {
    const onDone = renderEditor();
    fireEvent.change(screen.getAllByLabelText('minutes')[1], { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('tempo reached'), { target: { value: '144' } });
    fireEvent.change(screen.getByLabelText('note on the whole session'), { target: { value: 'slept fine' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiSend.mock.calls).toEqual([
      ['/api/practice-sessions/sitting', 'PUT', { notes: 'slept fine' }],
      ['/api/practice-logs/l2/correct', 'POST', { minutes: 20 }],
      ['/api/practice-logs/l2', 'PUT', { tempoReached: 144 }],
    ]);
  });

  it('takes a piece out of the day once it has asked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'remove dyad exercise' }));
    await waitFor(() => expect(apiSend).toHaveBeenCalledWith('/api/practice-logs/l1', 'DELETE'));
  });
});
