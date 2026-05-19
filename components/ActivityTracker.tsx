'use client';

import { useEffect } from 'react';
import { updateUserActivity } from '@/lib/analytics';

export default function ActivityTracker() {
  useEffect(() => {
    updateUserActivity();
    const interval = setInterval(updateUserActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
