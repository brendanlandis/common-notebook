'use client';

import { useId } from 'react';
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { toGradientStops, toSwatch } from './chartColors';

export interface LineSeries {
  key: string; // data key + config key
  label: string; // legend / tooltip label
  color: string; // base CSS color (e.g. 'var(--secondary-color)')
}

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  yDomainMax?: number;
  yLabel?: string;
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number;
}

// Tooltip that lists each series for the hovered x value, sorted by value
// descending — preserving the behaviour of the old practice-chart tooltip.
function makeLineTooltip(series: LineSeries[]) {
  const swatches = new Map(series.map((s) => [s.key, toSwatch(s.color)]));
  const labels = new Map(series.map((s) => [s.key, s.label]));

  return function LineTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;

    // Collapse duplicate dataKeys (glow underlay + main line share a key) and drop
    // empty values, then sort high → low.
    const seen = new Set<string>();
    const rows = payload
      .filter((entry) => {
        const key = String(entry.dataKey ?? '');
        if (!key || seen.has(key) || entry.value == null) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    if (rows.length === 0) return null;

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {rows.map((entry) => {
          const key = String(entry.dataKey);
          return (
            <div key={key} className="chart-tooltip-row">
              <span className="chart-tooltip-swatch" style={{ background: swatches.get(key) }} />
              <span className="chart-tooltip-name">{labels.get(key) ?? key}</span>
              <span className="chart-tooltip-value">{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  };
}

function LineLegend({ series }: { series: LineSeries[] }) {
  return (
    <ul className="chart-legend">
      {series.map((s) => (
        <li key={s.key} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: toSwatch(s.color) }} />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function LineChart({
  data,
  xKey,
  series,
  height = 400,
  yDomainMax,
  yLabel,
}: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const blurId = `${uid}-blur`;
  const LineTooltip = makeLineTooltip(series);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          {series.map((s, index) => {
            const [from, to] = toGradientStops(s.color);
            return (
              <linearGradient key={s.key} id={`${uid}-grad-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </linearGradient>
            );
          })}
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--primary-color)" opacity={0.1} />
        <XAxis
          dataKey={xKey}
          stroke="var(--primary-color)"
          tick={{ fill: 'var(--primary-color)', fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--primary-color)"
          tick={{ fill: 'var(--primary-color)', fontSize: 12 }}
          domain={yDomainMax ? [0, yDomainMax] : undefined}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--primary-color)' }
              : undefined
          }
        />
        <Tooltip content={<LineTooltip />} isAnimationActive={false} />
        <Legend content={<LineLegend series={series} />} />

        {/* Soft glow underlay: a wide, translucent, blurred copy of each line. */}
        {series.map((s, index) => (
          <Line
            key={`${s.key}-glow`}
            type="monotone"
            dataKey={s.key}
            stroke={`url(#${uid}-grad-${index})`}
            strokeWidth={7}
            strokeOpacity={0.18}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
            filter={`url(#${blurId})`}
          />
        ))}

        {/* Main gradient lines. */}
        {series.map((s, index) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={`url(#${uid}-grad-${index})`}
            strokeWidth={2.5}
            dot={{ r: 2, fill: s.color, stroke: 'none' }}
            activeDot={{ r: 5, fill: s.color, stroke: 'var(--background)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}
