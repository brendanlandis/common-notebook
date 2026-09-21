import {
  BroomIcon,
  MetronomeIcon,
  SunIcon,
  CompassIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

/**
 * A page's icon, shared by its menu link and the header's upper-left icon so the
 * two can't drift apart. Home and every /todo route get the broom.
 */
export default function PageIcon({
  path,
  ...props
}: { path: string } & IconProps) {
  if (path === "/practice") return <MetronomeIcon {...props} />;
  if (path === "/review/daily") return <SunIcon {...props} />;
  if (path === "/review/periodic") return <CompassIcon {...props} />;
  return <BroomIcon {...props} />;
}
