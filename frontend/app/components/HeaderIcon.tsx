'use client';

import { usePathname } from 'next/navigation';
import {
  BirdIcon,
  BroomIcon,
  MetronomeIcon
} from '@phosphor-icons/react';

export default function HeaderIcon() {
  const pathname = usePathname();

  const iconProps = { size: 40, weight: "duotone" as const };

  // Practice page
  if (pathname === '/practice') {
    return <MetronomeIcon {...iconProps} />;
  }

  // Task pages (index + per-world / per-project routes)
  if (pathname.startsWith('/todo')) {
    return <BroomIcon {...iconProps} />;
  }

  // Home or other pages
  return <BirdIcon {...iconProps} />;
}

