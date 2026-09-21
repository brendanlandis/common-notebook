'use client';

import { usePathname } from 'next/navigation';
import PageIcon, { headerPageIconSize } from '@/app/components/chrome/PageIcon';

// Matches the current page's menu icon.
export default function HeaderIcon() {
  const path = usePathname();
  return <PageIcon path={path} size={headerPageIconSize(path)} weight="duotone" />;
}
