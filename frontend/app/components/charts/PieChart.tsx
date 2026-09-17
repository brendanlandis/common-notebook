'use client';

import {
  PieChart as RePieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { paletteColor } from './chartColors';

export interface PieDatum {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieDatum[];
  height?: number;
  /** Inner radius — a positive value renders a donut instead of a solid pie. */
  innerRadius?: number | string;
  outerRadius?: number | string;
}

// Each slice, enriched with its solid fill color. `fill` is read by recharts to
// paint the sector; `color` drives the tooltip/legend chips.
interface PreparedSlice extends PieDatum {
  color: string;
  fill: string;
}

// Recharts hands the tooltip the original datum on `payload[0].payload`.
function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: PreparedSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  if (!slice) return null;

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-base-content/25 bg-base-100 px-2.5 py-2 text-xs text-base-content">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
        <span className="flex-1 text-left opacity-80">{slice.name}</span>
        <span className="font-semibold tabular-nums">{payload[0].value}</span>
      </div>
    </div>
  );
}

// Custom legend driven directly by the prepared slices (not the recharts payload),
// so each chip renders the slice's color.
function PieLegend({ data }: { data: PreparedSlice[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 text-[0.775rem]">
      {data.map((slice) => (
        <li key={slice.name} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
          <span>{slice.name}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PieChart({
  data,
  height = 260,
  innerRadius = 0,
  outerRadius = '80%',
}: PieChartProps) {
  const prepared: PreparedSlice[] = data.map((datum, index) => {
    const color = paletteColor(index);
    return { ...datum, color, fill: color };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={prepared}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          isAnimationActive={false}
          stroke="none"
        />
        <Tooltip content={<PieTooltip />} isAnimationActive={false} />
        <Legend content={<PieLegend data={prepared} />} />
      </RePieChart>
    </ResponsiveContainer>
  );
}
