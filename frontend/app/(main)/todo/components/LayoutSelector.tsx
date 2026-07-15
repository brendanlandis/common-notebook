import { useRouter, usePathname } from "next/navigation";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useWorlds } from "@/app/contexts/WorldsContext";
import { useViews } from "@/app/contexts/ViewsContext";
import { sortViewsByPosition, CODE_PRESETS } from "@/app/lib/views";

interface LayoutSelectorProps {
  value: string; // view slug (or "" on a world/project route)
  onChange: (slug: string) => void;
}

export default function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  const { views } = useViews();
  const router = useRouter();
  const pathname = usePathname();

  // The user's composable views, in their own order. The "stuff" view is hidden
  // when stuff projects are disabled.
  const dataViews = sortViewsByPosition(views).filter(
    (v) => v.systemKey !== "stuff" || stuffProjectsEnabled
  );

  // Per-world entries come from the user's worlds. The stuff world is surfaced by
  // the "stuff" view, not here.
  const worldOptions = worlds.filter((w) => w.systemKey !== "stuff");

  // On pages not represented by any view (a world/project route), `value` is "" —
  // show a blank row at the top so the select has something to display.
  const valueIsKnownView =
    views.some((v) => v.slug === value) || CODE_PRESETS.some((p) => p.slug === value);

  const handleChange = (v: string) => {
    if (v.startsWith("world:")) {
      // Per-world views live on their own route.
      router.push(`/todo/world/${v.slice("world:".length)}`);
      return;
    }
    // A view/preset: set it, and if we're on a world/project route, go back to
    // /todo so the selected view actually renders (that page reads the ruleset).
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
      {!valueIsKnownView && <option value=""></option>}
      {dataViews.map((view) => (
        <option key={view.documentId} value={view.slug}>
          {view.name}
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
        {CODE_PRESETS.map((preset) => (
          <option key={preset.slug} value={preset.slug}>
            {preset.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
