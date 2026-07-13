// Theme-aware color palette for the pie/line charts.
//
// Every color here is a reference to a daisyUI CSS custom property, so it flips
// automatically between the `retro` (light) and `dim` (dark) themes without any
// per-theme wiring. Colors are used solid — no gradients or glow.

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

// Base color for the slice/series at a given index, cycling the palette.
export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
