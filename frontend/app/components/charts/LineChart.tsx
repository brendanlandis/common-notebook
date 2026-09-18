'use client';

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

export interface LineSeries {
  key: string; // data key + config key
  label: string; // legend / tooltip label
  color: string; // base CSS color (e.g. 'var(--color-success)')
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
// descending — preserving the behavior of the old practice-chart tooltip.
function makeLineTooltip(series: LineSeries[]) {
  const swatches = new Map(series.map((s) => [s.key, s.color]));
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

    // Drop empty values, then sort high → low.
    const rows = payload
      .filter((entry) => entry.dataKey != null && entry.value != null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    if (rows.length === 0) return null;

    return (
      <div className="grid min-w-32 gap-1.5 rounded-lg border border-base-content/25 bg-base-100 px-2.5 py-2 text-xs text-base-content">
        <div className="text-left font-semibold">{label}</div>
        {rows.map((entry) => {
          const key = String(entry.dataKey);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: swatches.get(key) }} />
              <span className="flex-1 text-left opacity-80">{labels.get(key) ?? key}</span>
              <span className="font-semibold tabular-nums">{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  };
}

function LineLegend({ series }: { series: LineSeries[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 text-[0.775rem]">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
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
  const LineTooltip = makeLineTooltip(series);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-base-content)"
          opacity={0.1}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-base-content)', fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-base-content)', fontSize: 12 }}
          domain={yDomainMax ? [0, yDomainMax] : undefined}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--color-base-content)' }
              : undefined
          }
        />
        <Tooltip content={<LineTooltip />} isAnimationActive={false} />
        <Legend content={<LineLegend series={series} />} />

        {series.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            // Filled dot with a background-colored ring, which also masks the
            // line where it meets the dot — the gap/padding seen in the example.
            dot={{ r: 4, fill: s.color, stroke: 'var(--color-base-100)', strokeWidth: 3 }}
            activeDot={{ r: 6, fill: s.color, stroke: 'var(--color-base-100)', strokeWidth: 3 }}
            isAnimationActive={false}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}
