'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { UserProfile } from '@/types';

// Entry point — checks for completed user profile and routes accordingly
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const profile = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
    if (profile?.setupCompleted) {
      router.replace('/home');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="text-5xl mb-3">🍚</div>
        <p className="text-[#2D2D2D] text-lg font-semibold">饭饭</p>
        <p className="text-gray-400 text-sm mt-1">加载中…</p>
      </div>
    </div>
  );
}
