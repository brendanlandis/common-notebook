'use client';

import { useEffect } from 'react';

type FaviconType = 'potted-plant' | 'bird' | 'broom' | 'metronome' | 'pencil';

interface FaviconManagerProps {
  type: FaviconType;
}

export default function FaviconManager({ type }: FaviconManagerProps) {
  useEffect(() => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll('link[rel*="icon"]');
    existingLinks.forEach((link) => link.remove());

    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = `/api/favicon/${type}`;
    
    // Append to head
    document.head.appendChild(link);

    // Cleanup function
    return () => {
      link.remove();
    };
  }, [type]);

  return null;
}

