// Theme-aware gradient palette for the evilcharts-style pie/line charts.
//
// Every color here is a reference to a daisyUI CSS custom property, so it flips
// automatically between the `retro` (light) and `dim` (dark) themes without any
// per-theme wiring — which is why we don't need evilcharts' `.dark`-based
// ChartStyle machinery.

// Ordered base colors used to color pie slices by index (cycled when there are
// more slices than colors).
export const CHART_PALETTE = [
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-primary)',
  'var(--color-error)',
  'var(--color-neutral)',
] as const;

// A 2-stop gradient (base → lighter tint toward the page background) built from a
// single base color. Reproduces evilcharts' gradient fills while staying
// theme-aware: in the light theme the second stop lightens, in the dark theme it
// deepens, so the gradient reads either way.
export function toGradientStops(base: string): [string, string] {
  return [base, `color-mix(in oklch, ${base} 55%, var(--color-base-100))`];
}

// The CSS gradient used for tooltip/legend swatches (a small diagonal chip).
export function toSwatch(base: string): string {
  const [from, to] = toGradientStops(base);
  return `linear-gradient(135deg, ${from}, ${to})`;
}

// Base color for the slice/series at a given index, cycling the palette.
export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
