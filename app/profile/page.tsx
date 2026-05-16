'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, X, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Check } from 'lucide-react';
import { storageGet, storageSet, storageClear, STORAGE_KEYS } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { UserProfile } from '@/types';
import { ALL_SEASONINGS, ALL_EQUIPMENT } from '@/app/onboarding/page';

const DEFAULT_SEASONINGS = ALL_SEASONINGS;
const EQUIPMENT_OPTIONS = ALL_EQUIPMENT;

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
    storageSet(STORAGE_KEYS.USER_PROFILE, next);
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
        {/* Seasonings */}
        <Section title="调料库">
          <div className="flex flex-wrap gap-2 mb-3">
            {[...DEFAULT_SEASONINGS, ...extraSeasonings].map((s) => (
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
          <div className="flex gap-2">
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

        {/* Equipment */}
        <Section title="厨房设备">
          <div className="grid grid-cols-2 gap-2">
            {EQUIPMENT_OPTIONS.map((e) => {
              const selected = profile.equipment.includes(e);
              return (
                <button
                  key={e}
                  onClick={() => toggleEquipment(e)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-all active:scale-95 ${
                    selected ? 'border-[#FF6B47] bg-[#FFF0EB] text-[#FF6B47]' : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-[#FF6B47] bg-[#FF6B47]' : 'border-gray-300'
                  }`}>
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  {e}
                </button>
              );
            })}
          </div>
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

        {/* History Link */}
        <button
          onClick={() => router.push('/history')}
          className="w-full bg-white rounded-2xl p-4 text-left flex items-center justify-between border border-gray-100 active:scale-[0.98] transition-transform"
        >
          <span className="text-sm font-medium text-[#2D2D2D]">📖 历史记录</span>
          <ChevronLeft className="rotate-180 text-gray-400" size={16} />
        </button>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">{title}</h3>
      {children}
    </div>
  );
}
