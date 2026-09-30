import { describe, it, expect } from 'vitest';
import { lastTimeLabel, tempoLabel } from './PiecePopover';

describe('lastTimeLabel', () => {
  const today = '2026-09-30';
  it('says it the way you would', () => {
    expect(lastTimeLabel({ date: '2026-09-30', duration: 18 }, today)).toBe('today, 18 min');
    expect(lastTimeLabel({ date: '2026-09-29', duration: 12 }, today)).toBe('yesterday, 12 min');
    expect(lastTimeLabel({ date: '2026-09-27', duration: 15 }, today)).toBe('3 days ago, 15 min');
  });
  it('falls back to the date after two weeks', () => {
    expect(lastTimeLabel({ date: '2026-09-02', duration: 30 }, today)).toBe('9/2, 30 min');
  });
  it('leaves out minutes it has none of', () => {
    expect(lastTimeLabel({ date: '2026-09-29', duration: 0 }, today)).toBe('yesterday');
  });
});

describe('tempoLabel', () => {
  it('shows what the piece has and nothing for a piece without a tempo', () => {
    expect(tempoLabel({ tempo: 140, goalTempo: 160 })).toBe('140 bpm, goal 160');
    expect(tempoLabel({ tempo: 140, goalTempo: null })).toBe('140 bpm');
    expect(tempoLabel({ tempo: null, goalTempo: 208 })).toBe('goal 208 bpm');
    expect(tempoLabel({ tempo: null, goalTempo: null })).toBeNull();
  });
});
