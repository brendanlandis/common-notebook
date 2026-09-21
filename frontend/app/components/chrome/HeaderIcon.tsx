'use client';

import { usePathname } from 'next/navigation';
import PageIcon from '@/app/components/chrome/PageIcon';
import { CONTROL_ICON } from '@/app/components/chrome/iconSizes';

// Matches the current page's menu icon.
export default function HeaderIcon() {
  return <PageIcon path={usePathname()} size={CONTROL_ICON} weight="duotone" />;
}
