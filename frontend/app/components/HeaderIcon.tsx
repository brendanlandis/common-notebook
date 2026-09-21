'use client';

import { usePathname } from 'next/navigation';
import PageIcon from './PageIcon';

// Matches the current page's menu icon.
export default function HeaderIcon() {
  return <PageIcon path={usePathname()} size={40} weight="duotone" />;
}
