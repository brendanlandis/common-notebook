import { LAYOUT_PRESETS, type LayoutRuleset } from "@/app/types/layoutRuleset";

interface LayoutSelectorProps {
  value: string; // preset ID
  onChange: (presetId: string) => void;
}

export default function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  // Organize presets into groups
  const specialPresets = LAYOUT_PRESETS.filter(
    (preset) => preset.id === "good-morning" || preset.id === "everything" || preset.id === "roulette" || preset.id === "stuff" || preset.id === "later" || preset.id === "chores"
  );
  // Sort special presets to ensure correct order: good-morning, chores, everything, roulette, stuff, later
  const specialPresetOrder = ["good-morning", "chores", "everything", "roulette", "stuff", "later"];
  const sortedSpecialPresets = specialPresets.sort((a, b) => {
    const indexA = specialPresetOrder.indexOf(a.id);
    const indexB = specialPresetOrder.indexOf(b.id);
    return indexA - indexB;
  });
  const byWorldPresets = LAYOUT_PRESETS.filter((preset) => preset.groupBy === "world");
  const postMortemPresets = LAYOUT_PRESETS.filter((preset) => preset.id === "done");

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      id="order-selector"
      suppressHydrationWarning
    >
      {sortedSpecialPresets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
      <optgroup label="worlds">
        {byWorldPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="post mortem">
        {postMortemPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

// Export type for backward compatibility during transition
export type LayoutMode = "recurring on top" | "separate" | "separate by world";

