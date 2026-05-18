'use client';

import { useState, useEffect } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase/client';
import { getCloudSyncMode, isNewUser } from '@/lib/cloud-sync';
import { migrateAllDataToCloud } from '@/lib/data/migrate';

export default function CloudMigrationBanner() {
  const [visible, setVisible] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    const mode = getCloudSyncMode();
    if (mode === 'local' && !isNewUser()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  async function handleMigrate() {
    setMigrating(true);
    setErrorMsg(null);
    const result = await migrateAllDataToCloud();
    setMigrating(false);
    if (result.success) {
      setVisible(false);
    } else {
      setErrorMsg(result.error ?? '同步失败，请重试');
    }
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-blue-700 flex-1">
          ☁️ 开启云端备份，换设备也不丢数据
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-50"
          >
            {migrating ? '同步中...' : '立即开启'}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-xs text-blue-500 border border-blue-300 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            以后再说
          </button>
        </div>
      </div>
      {errorMsg && (
        <p className="text-xs text-red-500 mt-1.5">{errorMsg}</p>
      )}
    </div>
  );
}
