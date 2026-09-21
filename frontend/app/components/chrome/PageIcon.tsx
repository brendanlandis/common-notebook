import {
  BroomIcon,
  MetronomeIcon,
  SunIcon,
  CompassIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps } from "@phosphor-icons/react";

/**
 * Each page's icon, and its size in the header. The sizes were set by eye
 * (2026-09-21) so the four read as the same height as the header's other
 * icons at 32px: the metronome's thin outline reads small, the broom's bulk
 * reads large.
 */
function pageIcon(path: string): { Icon: Icon; headerSize: number } {
  if (path === "/practice") return { Icon: MetronomeIcon, headerSize: 34 };
  if (path === "/review/daily") return { Icon: SunIcon, headerSize: 32 };
  if (path === "/review/periodic") return { Icon: CompassIcon, headerSize: 32 };
  return { Icon: BroomIcon, headerSize: 31 };
}

/** The size this page's icon takes in the header. */
export const headerPageIconSize = (path: string) => pageIcon(path).headerSize;

/**
 * A page's icon, shared by its menu link and the header's upper-left icon so the
 * two can't drift apart. Home and every to-do route get the broom.
 */
export default function PageIcon({
  path,
  ...props
}: { path: string } & IconProps) {
  const { Icon } = pageIcon(path);
  return <Icon {...props} />;
}
