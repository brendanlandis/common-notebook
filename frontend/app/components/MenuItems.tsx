'use client';
import Link from 'next/link';
import {
  BirdIcon,
  BroomIcon,
  MetronomeIcon,
  PencilIcon,
} from '@phosphor-icons/react/dist/ssr';

export default function MenuItems() {
  const closeDrawer = () => {
    const drawerCheckbox = document.getElementById(
      'adminMenu'
    ) as HTMLInputElement;
    if (drawerCheckbox) drawerCheckbox.checked = false;
  };
  return (
    <>
      <li>
        <Link href="/" onClick={closeDrawer}>
          <BirdIcon size={30} weight="thin" />
          <span>home</span>
        </Link>
      </li>
      <li>
        <Link href="/todo" onClick={closeDrawer}>
          <BroomIcon size={30} weight="thin" />
          <span>to do</span>
        </Link>
      </li>
      <li>
        <Link href="/practice" onClick={closeDrawer}>
          <MetronomeIcon size={30} weight="thin" />
          <span>practice</span>
        </Link>
      </li>
      <li>
        <Link href="/notes" onClick={closeDrawer}>
          <PencilIcon size={30} weight="thin" />
          <span>notes</span>
        </Link>
      </li>
    </>
  );
}
