import { useRouter, usePathname } from "next/navigation";
import { LAYOUT_PRESETS } from "@/app/lib/layoutPresets";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useWorlds } from "@/app/contexts/WorldsContext";

interface LayoutSelectorProps {
  value: string; // preset ID (or "" on a world/project route)
  onChange: (presetId: string) => void;
}

export default function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  const router = useRouter();
  const pathname = usePathname();

  // Special (non-world) presets, in display order. The "stuff" view is hidden
  // when stuff projects are disabled.
  const specialPresetOrder = ["good-morning", "chores", "everything", "chipping-away", "roulette", "stuff", "later"];
  const specialPresets = LAYOUT_PRESETS.filter(
    (preset) => specialPresetOrder.includes(preset.id) && (preset.id !== "stuff" || stuffProjectsEnabled)
  ).sort((a, b) => specialPresetOrder.indexOf(a.id) - specialPresetOrder.indexOf(b.id));

  const reviewPresets = LAYOUT_PRESETS.filter(
    (preset) => preset.id === "done" || preset.id === "invoicing" || preset.id === "recurring"
  );

  // Per-world entries come from the user's worlds now (not presets). The stuff
  // world is surfaced by the "stuff" special preset, not here.
  const worldOptions = worlds.filter((w) => w.systemKey !== "stuff");

  // On pages not represented by any preset (a world/project route), `value` is
  // "" — show a blank row at the top so the select has something to display.
  const valueIsKnownPreset = LAYOUT_PRESETS.some((preset) => preset.id === value);

  const handleChange = (v: string) => {
    if (v.startsWith("world:")) {
      // Per-world views live on their own route.
      router.push(`/todo/world/${v.slice("world:".length)}`);
      return;
    }
    // A preset: set it, and if we're on a world/project route, go back to /todo
    // so the selected view actually renders (that page reads the ruleset).
    onChange(v);
    if (pathname !== "/todo") router.push("/todo");
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      id="order-selector"
      suppressHydrationWarning
    >
      {!valueIsKnownPreset && <option value=""></option>}
      {specialPresets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
      <optgroup label="worlds">
        {worldOptions.map((world) => (
          <option key={world.documentId} value={`world:${world.slug}`}>
            {world.title}
          </option>
        ))}
      </optgroup>
      <optgroup label="review">
        {reviewPresets.map((preset) => (
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
