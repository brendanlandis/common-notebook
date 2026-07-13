import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// ResponsiveContainer measures its parent (0x0 in jsdom) and renders nothing.
// Replace it with a version that injects fixed dimensions into the chart, the
// same way it does in a real browser, so the chart actually renders an <svg>.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 400, height: 300 }),
  };
});

import PieChart from './PieChart';
import LineChart, { type LineSeries } from './LineChart';

describe('chart smoke test', () => {
  it('renders the pie chart with solid sectors (no gradients/glow)', () => {
    const { container } = render(
      <PieChart
        data={[
          { name: 'alpha', value: 5 },
          { name: 'beta', value: 3 },
          { name: 'other', value: 2 },
        ]}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    // No gradient/glow defs — slices are painted with solid colours.
    expect(container.querySelectorAll('linearGradient').length).toBe(0);
    expect(container.querySelectorAll('filter').length).toBe(0);
    // Sectors rendered.
    expect(container.querySelectorAll('.recharts-pie-sector').length).toBeGreaterThan(0);
  });

  it('renders the line chart with a solid stroke per series (no gradients/glow)', () => {
    const series: LineSeries[] = [
      { key: 'guitar', label: 'guitar', color: 'var(--primary-color)' },
      { key: 'voice', label: 'voice', color: 'var(--secondary-color)' },
    ];
    const { container } = render(
      <LineChart
        data={[
          { date: '7/1', guitar: 30, voice: 10 },
          { date: '7/2', guitar: 20, voice: 40 },
        ]}
        xKey="date"
        series={series}
        yDomainMax={60}
        yLabel="minutes"
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    // No gradient/blur defs — lines are painted with solid colours.
    expect(container.querySelectorAll('linearGradient').length).toBe(0);
    expect(container.querySelectorAll('filter').length).toBe(0);
    // One curve per series (no glow underlay).
    expect(container.querySelectorAll('.recharts-line-curve').length).toBe(2);
    // Each curve uses its series colour directly.
    const strokes = Array.from(container.querySelectorAll('.recharts-line-curve')).map((el) =>
      el.getAttribute('stroke'),
    );
    expect(strokes).toEqual(['var(--primary-color)', 'var(--secondary-color)']);
    // Straight angular segments, not curves: a linear path uses line-to (L)
    // commands and no cubic-bezier (C) — monotone would emit C.
    const d = container.querySelector('.recharts-line-curve')?.getAttribute('d') ?? '';
    expect(d).toContain('L');
    expect(d).not.toContain('C');
    // A dot at every data point (2 series × 2 points), filled with the series
    // colour (a background-coloured ring gives the gap between line and dot).
    expect(container.querySelectorAll('.recharts-line-dot').length).toBe(4);
    const firstDot = container.querySelector('.recharts-line-dot');
    expect(firstDot?.getAttribute('fill')).toBe('var(--primary-color)');
    expect(firstDot?.getAttribute('stroke')).toBe('var(--background)');
  });
});
