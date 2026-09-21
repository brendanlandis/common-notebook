'use client';

import { useEffect } from 'react';

type FaviconType = 'potted-plant' | 'bird' | 'broom' | 'metronome' | 'pencil' | 'gear';

interface FaviconManagerProps {
  type: FaviconType;
}

export default function FaviconManager({ type }: FaviconManagerProps) {
  useEffect(() => {
    // Remove only dynamic favicon links (ones created by this component)
    // Preserve static fallback links from the HTML
    const existingDynamicLinks = document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]');
    existingDynamicLinks.forEach((link) => link.remove());

    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = `/api/favicon/${type}`;
    
    // Append to head (browsers will prioritize this over earlier favicon links)
    document.head.appendChild(link);

    // Cleanup function - only remove the dynamic link we created
    return () => {
      link.remove();
    };
  }, [type]);

  return null;
}

