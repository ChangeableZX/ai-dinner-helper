import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getUserId } from './user';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';
import { getCloudSyncMode } from '@/lib/cloud-sync';
import type { UserProfile } from '@/types';
import type { DbUserProfile } from './types';

// ─── 映射层 ───────────────────────────────────────────────────────

const SKILL_TO_DB: Record<UserProfile['skillLevel'], '新手' | '中等' | '熟手'> = {
  beginner:     '新手',
  intermediate: '中等',
  advanced:     '熟手',
};

const SKILL_FROM_DB: Record<'新手' | '中等' | '熟手', UserProfile['skillLevel']> = {
  '新手': 'beginner',
  '中等': 'intermediate',
  '熟手': 'advanced',
};

function toDbProfile(
  profile: UserProfile,
  userId: string,
): Omit<DbUserProfile, 'updated_at'> {
  return {
    user_id: userId,
    skill_level: SKILL_TO_DB[profile.skillLevel] ?? null,
    spice_tolerance: profile.spiceLevel,
    default_people_count: profile.servings,
    taboos: profile.avoidances,
    seasoning_library: profile.seasonings,
    equipment: profile.equipment,
    category_memory: {},
    // setupCompleted 暂存 metadata，待 Prompt 2 阶段评估是否升为正式字段
    metadata: { setupCompleted: profile.setupCompleted },
  };
}

function fromDbProfile(db: DbUserProfile): UserProfile {
  return {
    seasonings: db.seasoning_library ?? [],
    equipment: db.equipment ?? [],
    skillLevel: db.skill_level ? SKILL_FROM_DB[db.skill_level] : 'beginner',
    spiceLevel: db.spice_tolerance ?? 3,
    avoidances: db.taboos ?? [],
    servings: ((db.default_people_count ?? 1) as 1 | 2 | 3),
    setupCompleted:
      (db.metadata as { setupCompleted?: boolean })?.setupCompleted === true,
  };
}

// ─── 公共 API ─────────────────────────────────────────────────────

/**
 * 读取用户画像
 * cloud 模式: Supabase 优先，写回 localStorage 作缓存
 * local 模式: localStorage 优先，Supabase 仅在本地为空时兜底
 */
export async function getProfile(): Promise<UserProfile | null> {
  const cloudMode = isSupabaseEnabled() && getCloudSyncMode() === 'cloud';

  // local 模式：先查 localStorage
  if (!cloudMode) {
    const local = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
    if (local) return local;
  }

  // cloud 模式 / localStorage 为空时，尝试 Supabase
  if (isSupabaseEnabled()) {
    try {
      const userId = await getUserId();
      if (userId) {
        const { data, error } = await supabase!
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          const profile = fromDbProfile(data as DbUserProfile);
          storageSet(STORAGE_KEYS.USER_PROFILE, profile); // 缓存到本地
          return profile;
        }
      }
    } catch {}
  }

  // 最终兜底：localStorage
  return storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
}

/**
 * 保存用户画像
 * 始终写 localStorage；cloud 模式下同步等待 Supabase，local 模式异步触发
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  storageSet(STORAGE_KEYS.USER_PROFILE, profile);

  if (!isSupabaseEnabled()) return;

  const doSync = async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase!
      .from('user_profiles')
      .upsert(toDbProfile(profile, userId), { onConflict: 'user_id' });
    if (error) console.error('[data/profile] Supabase sync failed:', error);
  };

  if (getCloudSyncMode() === 'cloud') {
    await doSync().catch(() => {});
  } else {
    doSync().catch(() => {});
  }
}
