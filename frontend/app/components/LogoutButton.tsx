'use client';

import { useRouter, usePathname } from 'next/navigation';
import { PlugsIcon } from '@phosphor-icons/react';

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide logout button on login page
  if (pathname === '/admin/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <button onClick={handleLogout} aria-label="logout" id="logout-button">
      <PlugsIcon size={20} weight="regular" />
    </button>
  );
}

