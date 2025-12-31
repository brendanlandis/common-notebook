'use client';

import { usePathname } from 'next/navigation';
import { 
  BirdIcon,
  BroomIcon,
  MetronomeIcon,
  PencilIcon
} from '@phosphor-icons/react';

export default function AdminHeaderIcon() {
  const pathname = usePathname();

  const iconProps = { size: 40, weight: "regular" as const };

  // Practice page
  if (pathname === '/practice') {
    return <MetronomeIcon {...iconProps} />;
  }

  // Todo page
  if (pathname === '/todo') {
    return <BroomIcon {...iconProps} />;
  }

  // Notes page
  if (pathname === '/notes') {
    return <PencilIcon {...iconProps} />;
  }

  // Home or other pages
  return <BirdIcon {...iconProps} />;
}

