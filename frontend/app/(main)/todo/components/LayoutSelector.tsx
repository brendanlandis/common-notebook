import { useRouter } from "next/navigation";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useWorlds } from "@/app/contexts/WorldsContext";
import { useViews } from "@/app/contexts/ViewsContext";
import { sortViewsByPosition, getDefaultViewSlug, CODE_PRESETS } from "@/app/lib/views";

interface LayoutSelectorProps {
  value: string; // view slug, `world:<slug>`, or "" on a project route
}

export default function LayoutSelector({ value }: LayoutSelectorProps) {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  const { views } = useViews();
  const router = useRouter();

  // The user's composable views, in their own order. The "stuff" view is hidden
  // when stuff projects are disabled.
  const dataViews = sortViewsByPosition(views).filter(
    (v) => v.systemKey !== "stuff" || stuffProjectsEnabled
  );

  // Per-world entries come from the user's worlds. The stuff world is surfaced by
  // the "stuff" view, not here.
  const worldOptions = worlds.filter((w) => w.systemKey !== "stuff");

  // On pages not represented by any option (a project route), `value` is "" —
  // show a blank row at the top so the select has something to display. A view
  // slug, a code preset, or a `world:<slug>` option all count as known.
  const valueIsKnownView =
    views.some((v) => v.slug === value) ||
    CODE_PRESETS.some((p) => p.slug === value) ||
    worldOptions.some((w) => `world:${w.slug}` === value);

  const handleChange = (v: string) => {
    if (!v) return;
    if (v.startsWith("world:")) {
      // Per-world views live on their own route.
      router.push(`/todo/world/${v.slice("world:".length)}`);
      return;
    }
    // A view/preset lives at /todo/view/<slug>, except the default view, which
    // canonicalizes to bare /todo.
    if (v === getDefaultViewSlug(views, stuffProjectsEnabled)) {
      router.push("/todo");
    } else {
      router.push(`/todo/view/${v}`);
    }
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
