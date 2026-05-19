'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, X, ChevronLeft, ChevronDown } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { storageSet, STORAGE_KEYS } from '@/lib/storage';
import type { UserProfile } from '@/types';
import {
  trackPageView, trackOnboardingStarted, trackOnboardingCompleted,
  trackOnboardingStepCompleted,
} from '@/lib/analytics-events';

// ─── Static data ─────────────────────────────────────────────────

const SEASONING_GROUPS: Array<{ id: string; emoji: string; name: string; items: string[] }> = [
  {
    id: 'basic',
    emoji: '🧂',
    name: '基础咸鲜',
    items: ['盐', '生抽', '老抽', '醋', '料酒', '糖', '蚝油', '香油', '鸡精', '味精'],
  },
  {
    id: 'spicy',
    emoji: '🌶️',
    name: '辣味调料',
    items: ['干辣椒', '豆瓣酱', '老干妈', '辣椒粉', '孜然粉', '五香粉'],
  },
  {
    id: 'aromatics',
    emoji: '🌿',
    name: '香辛料',
    items: ['葱', '姜', '蒜', '花椒', '八角', '桂皮', '香叶', '白胡椒', '黑胡椒', '十三香'],
  },
  {
    id: 'sauces',
    emoji: '🥫',
    name: '酱料&粉类',
    items: ['淀粉', '面粉', '番茄酱', '芝麻酱'],
  },
];

const EQUIPMENT_GROUPS: Array<{ id: string; emoji: string; name: string; items: string[] }> = [
  { id: 'heat', emoji: '🔥', name: '加热设备', items: ['燃气灶', '电磁炉', '微波炉', '烤箱'] },
  { id: 'pots', emoji: '🍳', name: '锅具', items: ['炒锅', '平底锅', '蒸锅', '高压锅', '电饭煲'] },
  { id: 'appliances', emoji: '⚡', name: '小家电', items: ['空气炸锅', '料理机'] },
];

export const ALL_SEASONINGS = SEASONING_GROUPS.flatMap((g) => g.items);
export const ALL_EQUIPMENT = EQUIPMENT_GROUPS.flatMap((g) => g.items);

const PRESETS = {
  minimal: {
    label: '极简厨房', emoji: '🍳',
    desc: '基础调料 + 锅碗瓢盆', sub: '适合：刚搬家 / 极简主义',
    seasonings: ['盐', '生抽', '老抽', '醋', '糖', '香油', '葱', '姜', '蒜', '鸡精', '淀粉'],
    equipment: ['燃气灶', '炒锅', '电饭煲'],
  },
  normal: {
    label: '普通家庭厨房', emoji: '🥘',
    desc: '常见调料齐全 + 常用设备', sub: '适合：大部分人 ⭐ 推荐',
    recommended: true,
    seasonings: [
      '盐', '生抽', '老抽', '醋', '料酒', '糖', '蚝油', '香油', '鸡精',
      '干辣椒', '豆瓣酱', '辣椒粉', '葱', '姜', '蒜', '花椒', '八角',
      '白胡椒', '黑胡椒', '淀粉', '面粉',
    ],
    equipment: ['燃气灶', '电磁炉', '炒锅', '平底锅', '电饭煲', '微波炉'],
  },
  full: {
    label: '我爱做饭', emoji: '🌶️',
    desc: '调料丰富 + 全套设备', sub: '适合：经常下厨',
    seasonings: ALL_SEASONINGS,
    equipment: ALL_EQUIPMENT,
  },
} as const;

// Avoidances: grouped food items with emoji
const AVOIDANCE_GROUPS: Array<{
  id: string;
  title: string;
  items: Array<{ id: string; label: string; emoji: string }>;
}> = [
  {
    id: 'condiments',
    title: '常见调味食材',
    items: [
      { id: '香菜', label: '香菜', emoji: '🌿' },
      { id: '葱', label: '葱', emoji: '🧅' },
      { id: '姜', label: '姜', emoji: '🫚' },
      { id: '蒜', label: '蒜', emoji: '🧄' },
      { id: '辣', label: '辣', emoji: '🌶️' },
    ],
  },
  {
    id: 'redMeat',
    title: '红肉',
    items: [
      { id: '牛肉', label: '牛肉', emoji: '🥩' },
      { id: '羊肉', label: '羊肉', emoji: '🍖' },
      { id: '猪肉', label: '猪肉', emoji: '🐖' },
    ],
  },
  {
    id: 'whiteMeat',
    title: '白肉与蛋',
    items: [
      { id: '鸡肉', label: '鸡肉', emoji: '🐔' },
      { id: '鸭肉', label: '鸭肉', emoji: '🦆' },
      { id: '鸡蛋', label: '鸡蛋', emoji: '🥚' },
    ],
  },
  {
    id: 'seafood',
    title: '海鲜水产',
    items: [
      { id: '鱼', label: '鱼', emoji: '🐟' },
      { id: '虾', label: '虾', emoji: '🦐' },
      { id: '蟹', label: '蟹', emoji: '🦀' },
      { id: '贝类', label: '贝类', emoji: '🐚' },
      { id: '软体类', label: '软体类', emoji: '🦑' },
    ],
  },
  {
    id: 'other',
    title: '其他',
    items: [
      { id: '豆制品', label: '豆制品', emoji: '🫘' },
      { id: '奶制品', label: '奶制品', emoji: '🥛' },
      { id: '内脏', label: '内脏', emoji: '🫀' },
      { id: '菌菇', label: '菌菇', emoji: '🍄' },
    ],
  },
];

// Quick-diet preset packages that auto-check multiple items
// P1 extension point: future severity field ('mild' | 'strict') can be added here
// to drive different prompt constraints (mild = de-prioritise, strict = hard-filter)
const QUICK_DIET_PRESETS: Array<{ id: string; label: string; emoji: string; items: string[] }> = [
  { id: 'vegetarian', label: '素食', emoji: '🌱', items: ['牛肉', '羊肉', '猪肉', '鸡肉', '鸭肉', '鱼', '虾', '蟹', '贝类', '软体类'] },
  { id: 'noPork', label: '不吃猪肉', emoji: '☪️', items: ['猪肉'] },
  { id: 'noBeef', label: '不吃牛肉', emoji: '🐄', items: ['牛肉'] },
  { id: 'noSeafood', label: '海鲜过敏', emoji: '🚫', items: ['鱼', '虾', '蟹', '贝类', '软体类'] },
  { id: 'lactose', label: '乳糖不耐', emoji: '🥛', items: ['奶制品'] },
  { id: 'gluten', label: '麸质过敏', emoji: '🌾', items: ['面食'] },
];

const SKILL_OPTIONS: Array<{ value: UserProfile['skillLevel']; label: string; desc: string }> = [
  { value: 'beginner', label: '新手', desc: '只会最简单的' },
  { value: 'intermediate', label: '能做几道家常', desc: '日常家常没问题' },
  { value: 'advanced', label: '熟手', desc: '可以挑战复杂菜' },
];

// ─── Root ────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    trackPageView('onboarding');
    trackOnboardingStarted();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stepNames = ['welcome', 'preset', 'review', 'avoidance', 'preferences'];
    if (step > 0) trackOnboardingStepCompleted(step, stepNames[step] ?? `step_${step}`);
  }, [step]);

  // Kitchen setup (steps 1-2)
  const [seasonings, setSeasonings] = useState<string[]>(PRESETS.normal.seasonings as unknown as string[]);
  const [equipment, setEquipment] = useState<string[]>(PRESETS.normal.equipment as unknown as string[]);
  const [customSeasonings, setCustomSeasonings] = useState<string[]>([]);

  // Avoidances (step 3) — separated into system + custom for different chip styling
  const [avoidances, setAvoidances] = useState<string[]>([]);
  const [customAvoidances, setCustomAvoidances] = useState<string[]>([]);

  // Preferences (step 4)
  const [skillLevel, setSkillLevel] = useState<UserProfile['skillLevel']>('intermediate');
  const [spiceLevel, setSpiceLevel] = useState(2);
  const [servings, setServings] = useState<1 | 2 | 3>(1);

  function applyPreset(key: keyof typeof PRESETS) {
    setSeasonings([...PRESETS[key].seasonings] as string[]);
    setEquipment([...PRESETS[key].equipment] as string[]);
  }

  function handleFinish() {
    const allSeasonings = [...new Set([...seasonings, ...customSeasonings])];
    const allAvoidances = [...new Set([...avoidances, ...customAvoidances])];
    const profile: UserProfile = {
      seasonings: allSeasonings,
      equipment,
      skillLevel,
      spiceLevel,
      avoidances: allAvoidances,
      servings,
      setupCompleted: true,
    };
    storageSet(STORAGE_KEYS.USER_PROFILE, profile);
    trackOnboardingCompleted(Date.now() - startTimeRef.current);
    router.replace('/home');
  }

  // Progress bar: 3 dots mapped across 4 steps (1→dot1, 2→dot1, 3→dot2, 4→dot3)
  const progressFill = step <= 2 ? 1 : step === 3 ? 2 : 3;

  const steps = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} />,

    <PresetStep
      key="preset"
      onSelect={(key) => { applyPreset(key); setStep(2); }}
      onManual={() => setStep(2)}
      onBack={() => setStep(0)}
    />,

    <ReviewStep
      key="review"
      seasonings={seasonings}
      equipment={equipment}
      customSeasonings={customSeasonings}
      onToggleSeasoning={(s) =>
        setSeasonings((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
      }
      onToggleGroupSeasonings={(items, selectAll) =>
        setSeasonings((prev) =>
          selectAll ? [...new Set([...prev, ...items])] : prev.filter((x) => !items.includes(x))
        )
      }
      onToggleEquipment={(e) =>
        setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
      }
      onToggleGroupEquipment={(items, selectAll) =>
        setEquipment((prev) =>
          selectAll ? [...new Set([...prev, ...items])] : prev.filter((x) => !items.includes(x))
        )
      }
      onAddCustom={(val) => {
        if (val && !seasonings.includes(val) && !customSeasonings.includes(val))
          setCustomSeasonings((prev) => [...prev, val]);
      }}
      onRemoveCustom={(val) => setCustomSeasonings((prev) => prev.filter((x) => x !== val))}
      onBack={() => setStep(1)}
      onNext={() => setStep(3)}
    />,

    <AvoidancesStep
      key="avoidances"
      avoidances={avoidances}
      customAvoidances={customAvoidances}
      onToggle={(item) =>
        setAvoidances((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]))
      }
      onBulkSet={setAvoidances}
      onAddCustom={(val) => {
        if (val && !avoidances.includes(val) && !customAvoidances.includes(val))
          setCustomAvoidances((prev) => [...prev, val]);
      }}
      onRemoveCustom={(val) => setCustomAvoidances((prev) => prev.filter((x) => x !== val))}
      onBack={() => setStep(2)}
      onNext={() => setStep(4)}
      onSkip={() => setStep(4)}
    />,

    <PreferencesStep
      key="prefs"
      skillLevel={skillLevel}
      spiceLevel={spiceLevel}
      servings={servings}
      onSkillChange={setSkillLevel}
      onSpiceChange={setSpiceLevel}
      onServingsChange={setServings}
      onBack={() => setStep(3)}
      onFinish={handleFinish}
    />,
  ];

  return (
    <div className="min-h-screen flex flex-col page-enter">
      {step > 0 && (
        <div className="flex gap-1 px-6 pt-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= progressFill ? 'bg-[#FF6B47]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}
      <div className="flex-1">{steps[step]}</div>
    </div>
  );
}

// ─── Step 0: Welcome ─────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="text-7xl mb-6">🍳</div>
      <h1 className="text-3xl font-bold text-[#2D2D2D] mb-3 leading-tight">
        今晚做什么，<br />不用再纠结
      </h1>
      <p className="text-gray-500 text-base mb-10 leading-relaxed">
        告诉我你家有什么，今天有多累，<br />我帮你决定今晚吃什么
      </p>
      <button
        onClick={onNext}
        className="w-full max-w-xs bg-[#FF6B47] text-white text-lg font-semibold py-4 rounded-2xl active:scale-95 transition-transform"
      >
        开始设置
      </button>
    </div>
  );
}

// ─── Step 1: Preset Picker ───────────────────────────────────────

function PresetStep({
  onSelect, onManual, onBack,
}: {
  onSelect: (key: keyof typeof PRESETS) => void;
  onManual: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-6 pb-2">
        <button onClick={onBack} className="flex items-center text-gray-400 mb-4 -ml-1">
          <ChevronLeft size={20} /><span className="text-sm">返回</span>
        </button>
        <h2 className="text-2xl font-bold text-[#2D2D2D]">选个厨房方案</h2>
        <p className="text-gray-400 text-sm mt-1">一键搞定调料和设备，之后还可以微调</p>
      </div>
      <div className="flex-1 px-5 pt-4 pb-4 flex flex-col gap-4">
        {(Object.entries(PRESETS) as Array<[keyof typeof PRESETS, typeof PRESETS[keyof typeof PRESETS]]>).map(
          ([key, preset]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`w-full text-left p-5 rounded-3xl border-2 transition-all active:scale-[0.98] bg-white ${
                'recommended' in preset && preset.recommended
                  ? 'border-[#FF6B47] shadow-md shadow-[#FF6B47]/15'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">{preset.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-[#2D2D2D]">{preset.label}</p>
                    {'recommended' in preset && preset.recommended && (
                      <span className="text-xs bg-[#FF6B47] text-white px-2 py-0.5 rounded-full">推荐</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{preset.desc}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 ml-[52px] mb-2">{preset.sub}</p>
              <div className="flex gap-4 ml-[52px] text-xs text-gray-400">
                <span>🧂 {(preset.seasonings as readonly string[]).length} 种调料</span>
                <span>🍳 {(preset.equipment as readonly string[]).length} 件设备</span>
              </div>
            </button>
          ),
        )}
        <button onClick={onManual} className="text-center text-sm text-gray-400 underline underline-offset-4 py-2 mt-1">
          手动选择具体项目
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Review (Collapsible Groups) ────────────────────────

function ReviewStep({
  seasonings, equipment, customSeasonings,
  onToggleSeasoning, onToggleGroupSeasonings,
  onToggleEquipment, onToggleGroupEquipment,
  onAddCustom, onRemoveCustom, onBack, onNext,
}: {
  seasonings: string[]; equipment: string[]; customSeasonings: string[];
  onToggleSeasoning: (s: string) => void;
  onToggleGroupSeasonings: (items: string[], selectAll: boolean) => void;
  onToggleEquipment: (e: string) => void;
  onToggleGroupEquipment: (items: string[], selectAll: boolean) => void;
  onAddCustom: (val: string) => void;
  onRemoveCustom: (val: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');

  function toggleExpand(id: string) {
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function expandAll() {
    setExpandedIds(new Set([...SEASONING_GROUPS, ...EQUIPMENT_GROUPS].map((g) => g.id)));
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-6 pb-3">
        <button onClick={onBack} className="flex items-center text-gray-400 mb-4 -ml-1">
          <ChevronLeft size={20} /><span className="text-sm">返回</span>
        </button>
        <h2 className="text-2xl font-bold text-[#2D2D2D]">核对一下</h2>
        <p className="text-gray-400 text-sm mt-1">
          {seasonings.length + customSeasonings.length} 种调料 · {equipment.length} 件设备 &nbsp;·&nbsp;
          <button onClick={expandAll} className="text-[#FF6B47] underline underline-offset-2">详细自定义</button>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">调料库</p>
          <div className="space-y-2">
            {SEASONING_GROUPS.map((g) => {
              const sel = g.items.filter((i) => seasonings.includes(i)).length;
              return (
                <CollapsibleGroup
                  key={g.id} id={g.id} emoji={g.emoji} name={g.name} items={g.items}
                  selectedItems={seasonings} selCount={sel} allSelected={sel === g.items.length}
                  expanded={expandedIds.has(g.id)} onToggleExpand={() => toggleExpand(g.id)}
                  onToggleItem={onToggleSeasoning}
                  onToggleAll={() => onToggleGroupSeasonings(g.items, sel !== g.items.length)}
                />
              );
            })}
            {customSeasonings.length > 0 && (
              <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">自定义调料</p>
                <div className="flex flex-wrap gap-2">
                  {customSeasonings.map((s) => (
                    <span key={s} className="flex items-center gap-1 bg-[#FFF0EB] text-[#FF6B47] text-sm px-3 py-1 rounded-full border border-[#FFD4C4]">
                      {s}<button onClick={() => onRemoveCustom(s)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onAddCustom(customInput.trim()); setCustomInput(''); } }}
                placeholder="添加其他调料…"
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF6B47]"
              />
              <button onClick={() => { onAddCustom(customInput.trim()); setCustomInput(''); }}
                className="bg-[#FF6B47] text-white rounded-xl px-4 py-2.5 active:scale-95 transition-transform">
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">厨房设备</p>
          <div className="space-y-2">
            {EQUIPMENT_GROUPS.map((g) => {
              const sel = g.items.filter((i) => equipment.includes(i)).length;
              return (
                <CollapsibleGroup
                  key={g.id} id={g.id} emoji={g.emoji} name={g.name} items={g.items}
                  selectedItems={equipment} selCount={sel} allSelected={sel === g.items.length}
                  expanded={expandedIds.has(g.id)} onToggleExpand={() => toggleExpand(g.id)}
                  onToggleItem={onToggleEquipment}
                  onToggleAll={() => onToggleGroupEquipment(g.items, sel !== g.items.length)}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-6 py-4 bg-[#FAF7F2]">
        <button onClick={onNext} disabled={equipment.length === 0}
          className="w-full bg-[#FF6B47] disabled:opacity-40 text-white text-base font-semibold py-4 rounded-2xl active:scale-95 transition-transform">
          确认，下一步
        </button>
      </div>
    </div>
  );
}

// ─── Collapsible Group (shared by Step 2) ────────────────────────

function CollapsibleGroup({
  emoji, name, items, selectedItems, selCount, allSelected,
  expanded, onToggleExpand, onToggleItem, onToggleAll,
}: {
  id: string; emoji: string; name: string; items: string[];
  selectedItems: string[]; selCount: number; allSelected: boolean;
  expanded: boolean;
  onToggleExpand: () => void; onToggleItem: (item: string) => void; onToggleAll: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="flex items-center px-4 py-3 gap-3">
        <button onClick={onToggleExpand} className="flex items-center gap-3 flex-1 text-left">
          <span className="text-lg">{emoji}</span>
          <span className="text-sm font-semibold text-[#2D2D2D]">{name}</span>
          <span className="text-xs text-gray-400 ml-1">{selCount}/{items.length}</span>
          <ChevronDown size={16} className={`text-gray-400 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleAll(); }}
          className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 transition-colors ${
            allSelected ? 'text-gray-400 bg-gray-100' : 'text-[#FF6B47] bg-[#FFF0EB]'
          }`}>
          {allSelected ? '全不选' : '全选'}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 flex flex-wrap gap-2">
          {items.map((item) => {
            const sel = selectedItems.includes(item);
            return (
              <button key={item} onClick={() => onToggleItem(item)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  sel ? 'bg-[#FF6B47] text-white border-[#FF6B47]' : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}>
                {sel && <span className="mr-1 text-xs">✓</span>}{item}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Avoidances ──────────────────────────────────────────

function AvoidancesStep({
  avoidances, customAvoidances,
  onToggle, onBulkSet, onAddCustom, onRemoveCustom,
  onBack, onNext, onSkip,
}: {
  avoidances: string[];
  customAvoidances: string[];
  onToggle: (item: string) => void;
  onBulkSet: (items: string[]) => void;
  onAddCustom: (val: string) => void;
  onRemoveCustom: (val: string) => void;
  onBack: () => void; onNext: () => void; onSkip: () => void;
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const groupsSectionRef = useRef<HTMLDivElement>(null);

  // Check whether all items of a quick-preset are selected
  function isPresetActive(preset: typeof QUICK_DIET_PRESETS[number]) {
    return preset.items.every((item) => avoidances.includes(item));
  }

  // Toggle a quick-preset: select all its items (or deselect if all already active)
  function handlePresetToggle(preset: typeof QUICK_DIET_PRESETS[number]) {
    if (isPresetActive(preset)) {
      onBulkSet(avoidances.filter((a) => !preset.items.includes(a)));
    } else {
      onBulkSet([...new Set([...avoidances, ...preset.items])]);
      // Scroll to groups section so user sees what was checked (transparent, not black-box)
      setTimeout(() => {
        groupsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }

  const totalSelected = avoidances.length + customAvoidances.length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <button onClick={onBack} className="flex items-center text-gray-400 mb-4 -ml-1">
          <ChevronLeft size={20} /><span className="text-sm">返回</span>
        </button>
        <h2 className="text-2xl font-bold text-[#2D2D2D]">有什么不吃的吗？</h2>
        <p className="text-gray-400 text-sm mt-1 leading-relaxed">
          没有的话直接跳过这一步，我不会强行加菜的
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
        {/* ── Layer 2: Quick-diet presets ── */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            有特殊饮食习惯？一键设置：
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_DIET_PRESETS.map((preset) => {
              const active = isPresetActive(preset);
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetToggle(preset)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                    active
                      ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {active && <Check size={13} />}
                  {preset.emoji} {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Layer 1: Grouped food tags ── */}
        {/*
          P1 extension point: future severity distinction (轻度规避 / 严格禁止)
          Implementation plan:
          - Add `avoidanceSeverity: Record<string, 'mild' | 'strict'>` to UserProfile
          - Long-press on a chip opens a small popover to pick severity
          - mild  → LLM hint: "try not to use {item}, user prefers to avoid it"
          - strict → LLM hint: "absolutely no {item}, user has a strict restriction"
        */}
        <div ref={groupsSectionRef} className="space-y-5">
          {AVOIDANCE_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-xs text-gray-400 font-medium mb-2">【{group.title}】</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(({ id, label, emoji }) => {
                  const selected = avoidances.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => onToggle(id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border-2 transition-all active:scale-95 ${
                        selected
                          ? 'bg-red-50 border-red-400 text-red-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Layer 3: Custom additions (collapsed by default) ── */}
        <div>
          <button
            onClick={() => setShowCustomInput((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-400 active:text-[#FF6B47] transition-colors"
          >
            <ChevronDown size={15} className={`transition-transform ${showCustomInput ? 'rotate-180' : ''}`} />
            还有其他不吃的？自己加一个
          </button>

          {showCustomInput && (
            <div className="mt-3 space-y-3">
              {customAvoidances.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customAvoidances.map((item) => (
                    // Custom items use dashed border to distinguish from system presets
                    <span
                      key={item}
                      className="flex items-center gap-1 bg-white text-gray-600 text-sm px-3 py-1.5 rounded-full border-2 border-dashed border-gray-300"
                    >
                      {item}
                      <button onClick={() => onRemoveCustom(item)} className="ml-0.5 text-gray-400 hover:text-red-500">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onAddCustom(customInput.trim()); setCustomInput(''); }
                  }}
                  placeholder="比如：榴莲、韭菜…"
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF6B47]"
                />
                <button
                  onClick={() => { onAddCustom(customInput.trim()); setCustomInput(''); }}
                  className="bg-[#FF6B47] text-white rounded-xl px-4 py-2.5 active:scale-95 transition-transform"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-[#FAF7F2] space-y-3">
        <button
          onClick={onNext}
          className="w-full bg-[#FF6B47] text-white text-base font-semibold py-4 rounded-2xl active:scale-95 transition-transform"
        >
          {totalSelected > 0 ? `已标记 ${totalSelected} 项，下一步` : '下一步'}
        </button>
        <button onClick={onSkip} className="w-full text-center text-sm text-gray-400 py-1">
          跳过这一步
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Preferences (skill / spice / servings only) ─────────

function PreferencesStep({
  skillLevel, spiceLevel, servings,
  onSkillChange, onSpiceChange, onServingsChange,
  onBack, onFinish,
}: {
  skillLevel: UserProfile['skillLevel']; spiceLevel: number; servings: 1 | 2 | 3;
  onSkillChange: (v: UserProfile['skillLevel']) => void;
  onSpiceChange: (v: number) => void;
  onServingsChange: (v: 1 | 2 | 3) => void;
  onBack: () => void; onFinish: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-6 pb-2">
        <button onClick={onBack} className="flex items-center text-gray-400 mb-4 -ml-1">
          <ChevronLeft size={20} /><span className="text-sm">返回</span>
        </button>
        <h2 className="text-2xl font-bold text-[#2D2D2D]">最后几个偏好</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-4">
        {/* Skill Level */}
        <div>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-2">厨艺水平</p>
          <div className="grid grid-cols-3 gap-2">
            {SKILL_OPTIONS.map(({ value, label, desc }) => (
              <button key={value} onClick={() => onSkillChange(value)}
                className={`p-3 rounded-2xl border-2 text-center transition-all active:scale-95 ${
                  skillLevel === value ? 'border-[#FF6B47] bg-[#FFF0EB]' : 'border-gray-200 bg-white'
                }`}>
                <p className={`text-sm font-semibold ${skillLevel === value ? 'text-[#FF6B47]' : 'text-[#2D2D2D]'}`}>{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Spice Level */}
        <div>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-3">
            辣度承受度&nbsp;
            <span className="text-[#FF6B47]">{'🌶'.repeat(spiceLevel)}</span>
            <span className="text-gray-300">{'🌶'.repeat(5 - spiceLevel)}</span>
          </p>
          <Slider min={1} max={5} step={1} value={[spiceLevel]}
            onValueChange={(v) => onSpiceChange(Array.isArray(v) ? (v as number[])[0] : (v as number))} />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>不吃辣</span><span>重口味</span>
          </div>
        </div>

        {/* Servings */}
        <div>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-2">默认几人份</p>
          <div className="flex gap-3">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} onClick={() => onServingsChange(n)}
                className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                  servings === n ? 'border-[#FF6B47] bg-[#FFF0EB] text-[#FF6B47]' : 'border-gray-200 bg-white text-gray-600'
                }`}>
                {n === 3 ? '3+ 人' : `${n} 人`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">ℹ️</span>
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">关于你的数据</p>
              <p className="text-amber-800 leading-relaxed">
                这是 AI 产品作品集 demo，使用匿名身份。
                你的食材库、画像、烹饪记录会保存在这个浏览器，
                <span className="font-medium">换设备不会自动同步</span>。
              </p>
              <p className="text-xs text-amber-700 mt-2">
                💡 之后可以在「我的」里导出数据，在新设备导入
              </p>
            </div>
          </div>
        </div>
        <button onClick={onFinish}
          className="w-full bg-[#FF6B47] text-white text-base font-semibold py-4 rounded-2xl active:scale-95 transition-transform">
          开始用饭饭 🍚
        </button>
      </div>
    </div>
  );
}
