import { describe, it, expect } from 'vitest';
import { buildHistory, practiceDays, blocksText } from './history';
import type { PracticeLog, PracticeSession, StrapiBlock } from '@/app/types/index';

const guitar = { documentId: 'guitar', title: 'guitar' };
const ear = { documentId: 'ear', title: 'ear training' };

const note = (text: string) =>
  [{ type: 'paragraph', children: [{ type: 'text', text }] }] as unknown as StrapiBlock[];

const log = (over: Partial<PracticeLog> & { piece: string; subject?: typeof guitar | null }): PracticeLog =>
  ({
    documentId: `${over.piece}-${over.date}-${over.start}`,
    start: over.start ?? `${over.date}T15:00:00Z`,
    stop: 'stop' in over ? over.stop : `${over.date}T16:00:00Z`,
    duration: 10,
    notes: [],
    material: { documentId: over.piece, title: over.piece, project: over.subject === undefined ? guitar : over.subject },
    ...over,
  }) as unknown as PracticeLog;

describe('buildHistory', () => {
  it('sums each subject per day, newest first, with the session note on its line', () => {
    const logs = [
      log({ piece: 'dyad', date: '2026-09-30', duration: 6, start: '2026-09-30T15:00:00Z', notes: note('second shape buzzes') }),
      log({ piece: 'reversal', date: '2026-09-30', duration: 18, start: '2026-09-30T15:06:00Z', notes: note('turnaround rushes') }),
      log({ piece: 'jesus', date: '2026-09-29', duration: 32 }),
      log({ piece: 'guitar sun', date: '2026-09-27', duration: 20 }),
      log({ piece: 'intervals', date: '2026-09-27', duration: 15, subject: ear, notes: note('sixths still a coin toss') }),
    ];
    const sessions = [
      { documentId: 's1', date: '2026-09-30', notes: 'short on sleep', subject: guitar },
    ] as unknown as PracticeSession[];

    expect(buildHistory(logs, sessions, '2026-09-01')).toEqual([
      {
        date: '2026-09-30',
        subjects: [
          {
            key: 'guitar',
            title: 'guitar',
            minutes: 24,
            note: 'short on sleep',
            pieces: [
              { title: 'dyad', note: 'second shape buzzes' },
              { title: 'reversal', note: 'turnaround rushes' },
            ],
          },
        ],
      },
      { date: '2026-09-29', subjects: [{ key: 'guitar', title: 'guitar', minutes: 32, note: null, pieces: [] }] },
      {
        date: '2026-09-27',
        subjects: [
          { key: 'guitar', title: 'guitar', minutes: 20, note: null, pieces: [] },
          { key: 'ear', title: 'ear training', minutes: 15, note: null, pieces: [{ title: 'intervals', note: 'sixths still a coin toss' }] },
        ],
      },
    ]);
  });

  it('leaves out stretches still running and days before the window', () => {
    const logs = [
      log({ piece: 'now', date: '2026-09-30', stop: null }),
      log({ piece: 'old', date: '2026-08-01' }),
    ];
    expect(buildHistory(logs, [], '2026-09-01')).toEqual([]);
  });

  it('leaves out a line with no minutes and nothing written, and a day of only those', () => {
    const logs = [
      log({ piece: 'blip', date: '2026-09-23', duration: 0 }),
      log({ piece: 'noted', date: '2026-09-30', duration: 0, notes: note('just checking the tuning') }),
    ];
    const history = buildHistory(logs, [], '2026-09-01');
    expect(history.map((d) => d.date)).toEqual(['2026-09-30']);
  });

  it('files a piece with no subject under incidentals', () => {
    const [day] = buildHistory([log({ piece: 'loose', date: '2026-09-30', subject: null })], [], '2026-09-01');
    expect(day.subjects[0]).toMatchObject({ title: 'incidentals', minutes: 10 });
  });
});

describe('practiceDays', () => {
  it('counts distinct days with finished practice in the window', () => {
    const logs = [
      log({ piece: 'a', date: '2026-09-30' }),
      log({ piece: 'b', date: '2026-09-30' }),
      log({ piece: 'c', date: '2026-09-28' }),
      log({ piece: 'd', date: '2026-09-27', stop: null }),
      log({ piece: 'e', date: '2026-08-01' }),
    ];
    expect(practiceDays(logs, '2026-09-01')).toBe(2);
  });
});

describe('blocksText', () => {
  it('reads the words out of a rich-text note, and nothing out of an empty one', () => {
    expect(blocksText(note('  bridge is clean  '))).toBe('bridge is clean');
    expect(blocksText([{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] as never)).toBe('');
    expect(blocksText(null)).toBe('');
  });
});
