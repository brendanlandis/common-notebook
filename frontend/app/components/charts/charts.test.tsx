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

  it('renders the line chart with a gradient stroke per series', () => {
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
    // One gradient def per series.
    expect(container.querySelectorAll('linearGradient').length).toBe(2);
    // Glow underlay + main line = 2 curves per series.
    expect(container.querySelectorAll('.recharts-line-curve').length).toBe(4);
  });
});
