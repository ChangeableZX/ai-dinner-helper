'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SEASONING_GROUP_DEFS, EQUIPMENT_GROUP_DEFS } from '@/lib/profile-groups';
import { storageGet, storageClear, STORAGE_KEYS } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { UserProfile } from '@/types';
import { ALL_SEASONINGS } from '@/app/onboarding/page';
import { saveProfile as persistProfile } from '@/lib/data/profile';
import { isSupabaseEnabled } from '@/lib/supabase/client';
import { getCloudSyncMode, setCloudSyncMode, type CloudSyncMode } from '@/lib/cloud-sync';
import { migrateAllDataToCloud } from '@/lib/data/migrate';

const DEFAULT_SEASONINGS = ALL_SEASONINGS;

const AVOIDANCE_OPTIONS = ['香菜','葱','姜','蒜','海鲜','牛羊肉'];

const SKILL_OPTIONS: Array<{ value: UserProfile['skillLevel']; label: string }> = [
  { value: 'beginner', label: '新手' },
  { value: 'intermediate', label: '能做几道家常' },
  { value: 'advanced', label: '熟手' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { resetSession } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [customSeasoning, setCustomSeasoning] = useState('');
  const [customAvoidance, setCustomAvoidance] = useState('');

  useEffect(() => {
    const p = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
    if (p) {
      setProfile(p);
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  function save(updates: Partial<UserProfile>) {
    if (!profile) return;
    const next = { ...profile, ...updates };
    setProfile(next);
    persistProfile(next).catch(() => {});
  }

  function toggleSeasoning(s: string) {
    if (!profile) return;
    const next = profile.seasonings.includes(s)
      ? profile.seasonings.filter((x) => x !== s)
      : [...profile.seasonings, s];
    save({ seasonings: next });
  }

  function addCustomSeasoning() {
    const val = customSeasoning.trim();
    if (val && profile && !profile.seasonings.includes(val)) {
      save({ seasonings: [...profile.seasonings, val] });
    }
    setCustomSeasoning('');
  }

  function toggleEquipment(e: string) {
    if (!profile) return;
    const next = profile.equipment.includes(e)
      ? profile.equipment.filter((x) => x !== e)
      : [...profile.equipment, e];
    save({ equipment: next });
  }

  function toggleAvoidance(a: string) {
    if (!profile) return;
    const next = profile.avoidances.includes(a)
      ? profile.avoidances.filter((x) => x !== a)
      : [...profile.avoidances, a];
    save({ avoidances: next });
  }

  function addCustomAvoidance() {
    const val = customAvoidance.trim();
    if (val && profile && !profile.avoidances.includes(val)) {
      save({ avoidances: [...profile.avoidances, val] });
    }
    setCustomAvoidance('');
  }

  function handleReset() {
    storageClear();
    resetSession();
    router.replace('/onboarding');
  }

  if (!profile) return null;

  const extraSeasonings = profile.seasonings.filter((s) => !DEFAULT_SEASONINGS.includes(s));
  const extraAvoidances = profile.avoidances.filter((a) => !AVOIDANCE_OPTIONS.includes(a));

  return (
    <div className="flex flex-col min-h-screen page-enter pb-8">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D]">我的画像</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Seasonings — grouped display */}
        <Section title="调料库">
          {SEASONING_GROUP_DEFS.map((group) => {
            const items =
              group.name === '其他'
                ? [...group.items, ...extraSeasonings]
                : group.items;
            return (
              <div key={group.name} className="mb-3 last:mb-0">
                <p className="text-xs font-medium text-gray-400 mb-2">
                  {group.emoji} {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSeasoning(s)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                        profile.seasonings.includes(s)
                          ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                          : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      {profile.seasonings.includes(s) && <span className="mr-1 text-xs">✓</span>}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 mt-3">
            <input
              value={customSeasoning}
              onChange={(e) => setCustomSeasoning(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomSeasoning()}
              placeholder="添加其他调料…"
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF6B47]"
            />
            <button onClick={addCustomSeasoning} className="bg-[#FF6B47] text-white rounded-xl px-4 py-2.5 active:scale-95 transition-transform">
              <Plus size={18} />
            </button>
          </div>
        </Section>

        {/* Equipment — grouped display */}
        <Section title="厨房设备">
          {EQUIPMENT_GROUP_DEFS.map((group, idx) => (
            <div key={group.name} className={idx > 0 ? 'mt-3' : ''}>
              <p className="text-xs font-medium text-gray-400 mb-2">
                {group.emoji} {group.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((e) => (
                  <button
                    key={e}
                    onClick={() => toggleEquipment(e)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                      profile.equipment.includes(e)
                        ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {profile.equipment.includes(e) && <span className="mr-1 text-xs">✓</span>}
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Skill Level */}
        <Section title="厨艺水平">
          <div className="grid grid-cols-3 gap-2">
            {SKILL_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => save({ skillLevel: value })}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                  profile.skillLevel === value
                    ? 'border-[#FF6B47] bg-[#FFF0EB] text-[#FF6B47]'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Spice Level */}
        <Section title={`辣度承受度 · ${'🌶'.repeat(profile.spiceLevel)}${'⬜'.repeat(Math.max(0, 5 - profile.spiceLevel))}`}>
          <Slider
            min={1} max={5} step={1}
            value={[profile.spiceLevel]}
            onValueChange={(v) => save({ spiceLevel: Array.isArray(v) ? (v as number[])[0] : (v as number) })}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>不吃辣</span><span>重口味</span>
          </div>
        </Section>

        {/* Avoidances */}
        <Section title="忌口">
          <div className="flex flex-wrap gap-2 mb-2">
            {[...AVOIDANCE_OPTIONS, ...extraAvoidances].map((a) => (
              <button
                key={a}
                onClick={() => toggleAvoidance(a)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                  profile.avoidances.includes(a)
                    ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customAvoidance}
              onChange={(e) => setCustomAvoidance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomAvoidance()}
              placeholder="其他不吃的…"
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF6B47]"
            />
            <button onClick={addCustomAvoidance} className="bg-[#FF6B47] text-white rounded-xl px-4 py-2.5 active:scale-95 transition-transform">
              <Plus size={18} />
            </button>
          </div>
        </Section>

        {/* Servings */}
        <Section title="默认几人份">
          <div className="flex gap-3">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => save({ servings: n })}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                  profile.servings === n
                    ? 'border-[#FF6B47] bg-[#FFF0EB] text-[#FF6B47]'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {n === 3 ? '3+ 人' : `${n} 人`}
              </button>
            ))}
          </div>
        </Section>

        {/* Stats Link */}
        <StatsEntryCard router={router} />

        {/* History Link */}
        <button
          onClick={() => router.push('/history')}
          className="w-full bg-white rounded-2xl p-4 text-left flex items-center justify-between border border-gray-100 active:scale-[0.98] transition-transform"
        >
          <span className="text-sm font-medium text-[#2D2D2D]">📖 历史记录</span>
          <ChevronLeft className="rotate-180 text-gray-400" size={16} />
        </button>

        {/* Cloud Sync */}
        {isSupabaseEnabled() && <CloudSyncSection />}

        {/* Reset */}
        <button
          onClick={() => setShowResetDialog(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-100 text-red-400 text-sm font-medium active:scale-[0.98] transition-all"
        >
          <Trash2 size={16} />
          重置所有数据
        </button>
      </div>

      {/* Reset Confirm Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="mx-auto max-w-[340px] rounded-3xl p-6 text-center">
          <div className="text-4xl mb-3">🗑️</div>
          <h3 className="text-lg font-bold text-[#2D2D2D] mb-2">确定要重置吗？</h3>
          <p className="text-gray-400 text-sm mb-6">所有数据（画像、历史记录）都会清空，不可恢复</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetDialog(false)}
              className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-medium"
            >
              取消
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-2xl bg-red-50 text-red-500 font-medium"
            >
              确认清空
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CloudSyncSection() {
  const [mode, setMode] = useState<CloudSyncMode>(() => getCloudSyncMode());
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleEnable() {
    setSyncing(true);
    setErrorMsg(null);
    const result = await migrateAllDataToCloud();
    setSyncing(false);
    if (result.success) {
      setMode('cloud');
    } else {
      setErrorMsg(result.error ?? '同步失败，请重试');
    }
  }

  function handleDisable() {
    setCloudSyncMode('local');
    setMode('local');
  }

  return (
    <Section title="数据同步">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#2D2D2D]">
            {mode === 'cloud' ? '☁️ 云端备份已开启' : mode === 'migrating' ? '⏳ 同步中...' : '📱 仅本地存储'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {mode === 'cloud'
              ? '数据已备份到云端，换设备不丢失'
              : '开启后数据备份到云端，换设备可恢复'}
          </p>
        </div>
        {mode !== 'migrating' && (
          <button
            onClick={mode === 'cloud' ? handleDisable : handleEnable}
            disabled={syncing}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 ${
              mode === 'cloud'
                ? 'bg-gray-100 text-gray-500 border border-gray-200'
                : 'bg-[#FF6B47] text-white'
            }`}
          >
            {syncing ? '同步中...' : mode === 'cloud' ? '关闭' : '开启'}
          </button>
        )}
      </div>
      {errorMsg && (
        <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
      )}
    </Section>
  );
}

function StatsEntryCard({ router }: { router: ReturnType<typeof useRouter> }) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { storageGet, STORAGE_KEYS } = await import('@/lib/storage');
      const history = storageGet<Array<{ rating?: string | null }>>(STORAGE_KEYS.HISTORY, []);
      setTotal(history.length);
    }
    load();
  }, []);

  return (
    <button
      onClick={() => router.push('/profile/stats')}
      className="w-full bg-white rounded-2xl p-4 text-left flex items-center justify-between border border-gray-100 active:scale-[0.98] transition-transform"
    >
      <div>
        <p className="text-sm font-medium text-[#2D2D2D]">📊 我的烹饪数据</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {total != null && total > 0 ? `你已经做了 ${total} 道菜` : '查看你的烹饪足迹'}
        </p>
      </div>
      <ChevronLeft className="rotate-180 text-gray-400" size={16} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">{title}</h3>
      {children}
    </div>
  );
}
