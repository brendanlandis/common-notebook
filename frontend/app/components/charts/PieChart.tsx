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

// Each slice, enriched with its solid fill colour. `fill` is read by recharts to
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
    <div className="chart-tooltip">
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-swatch" style={{ background: slice.color }} />
        <span className="chart-tooltip-name">{slice.name}</span>
        <span className="chart-tooltip-value">{payload[0].value}</span>
      </div>
    </div>
  );
}

// Custom legend driven directly by the prepared slices (not the recharts payload),
// so each chip renders the slice's colour.
function PieLegend({ data }: { data: PreparedSlice[] }) {
  return (
    <ul className="chart-legend">
      {data.map((slice) => (
        <li key={slice.name} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: slice.color }} />
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
