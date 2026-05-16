'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { X, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';
import type { Recipe, HistoryRecord, CookingStep } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function CookingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { getRecipeById, ingredients, fatigueLevel, setCookingStep, currentCookingStep } = useAppStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [step, setStep] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stepFlash, setStepFlash] = useState(false);

  // Touch gesture state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const id = params.id;
    let r = getRecipeById(id);
    if (!r) {
      const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
      r = history.find((h) => h.recipe.id === id)?.recipe;
    }
    if (r) {
      setRecipe(r);
    } else {
      router.replace('/home');
    }
  }, [params.id, getRecipeById, router]);

  const allSteps: CookingStep[] = recipe?.cookingSteps ?? [];
  const currentStep = allSteps[step];
  const isLastStep = step === allSteps.length - 1;

  function nextStep() {
    if (isLastStep) {
      setShowFeedback(true);
      return;
    }
    setStepFlash(true);
    setTimeout(() => setStepFlash(false), 400);
    const next = step + 1;
    setStep(next);
    setCookingStep(next);
  }

  function prevStep() {
    if (step === 0) return;
    const prev = step - 1;
    setStep(prev);
    setCookingStep(prev);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) nextStep();
      else prevStep();
    }
  }

  if (!recipe) return null;

  return (
    <div
      className={`flex flex-col min-h-screen bg-[#FAF7F2] transition-colors ${stepFlash ? 'bg-[#FFF0EB]' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 w-full">
        <div
          className="h-full bg-[#FF6B47] transition-all duration-500"
          style={{ width: `${((step + 1) / allSteps.length) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-sm text-gray-400">
          第 <span className="text-[#FF6B47] font-bold">{step + 1}</span> / {allSteps.length} 步
        </span>
        <button
          onClick={() => setShowExitDialog(true)}
          className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 active:scale-95 transition-transform"
        >
          <X size={18} />
        </button>
      </div>

      {/* Recipe name */}
      <p className="text-sm text-gray-400 px-6 mb-6">{recipe.name}</p>

      {/* Step content */}
      <div className="flex-1 px-6 flex flex-col">
        {currentStep && (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-sm flex-1 flex flex-col justify-center min-h-[260px]">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-5xl font-bold text-[#FF6B47] leading-none">{currentStep.order}</span>
                <p className="text-xl font-semibold text-[#2D2D2D] leading-relaxed flex-1 mt-2">
                  {currentStep.action}
                </p>
              </div>

              {currentStep.durationSeconds && currentStep.durationSeconds > 0 && (
                <div className="mt-2">
                  <StepTimer seconds={currentStep.durationSeconds} />
                </div>
              )}

              {currentStep.keyTip && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 rounded-2xl p-4">
                  <Flame size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700">{currentStep.keyTip}</p>
                </div>
              )}

              {currentStep.parallelTask && (
                <div className="mt-3 bg-blue-50 rounded-2xl p-4">
                  <p className="text-sm text-blue-600">
                    ⚡ 同时：{currentStep.parallelTask}
                  </p>
                </div>
              )}
            </div>

            {/* Step navigation */}
            <div className="flex gap-4 mt-6 mb-8">
              <button
                onClick={prevStep}
                disabled={step === 0}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 disabled:opacity-30 active:scale-[0.98] transition-all"
              >
                <ChevronLeft size={20} />
                上一步
              </button>
              <button
                onClick={nextStep}
                className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF6B47] text-white font-semibold active:scale-[0.98] transition-transform shadow-lg shadow-[#FF6B47]/30"
              >
                {isLastStep ? '完成！🎉' : '下一步'}
                {!isLastStep && <ChevronRight size={20} />}
              </button>
            </div>

            {/* Swipe hint */}
            <p className="text-center text-xs text-gray-300 mb-4">左右滑动也可以切换步骤</p>
          </>
        )}
      </div>

      {/* Exit confirm dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="mx-auto max-w-[340px] rounded-3xl p-6 text-center">
          <div className="text-4xl mb-3">🍳</div>
          <h3 className="text-lg font-bold text-[#2D2D2D] mb-2">做了一半，要走吗？</h3>
          <p className="text-gray-400 text-sm mb-6">进度不会保存哦</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowExitDialog(false)}
              className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-medium active:scale-95 transition-transform"
            >
              继续做
            </button>
            <button
              onClick={() => router.replace('/home')}
              className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 font-medium active:scale-95 transition-transform"
            >
              先走了
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback modal */}
      {showFeedback && recipe && (
        <FeedbackModal
          recipe={recipe}
          ingredients={ingredients}
          fatigueLevel={fatigueLevel ?? 2}
          onDone={() => router.replace('/home')}
        />
      )}
    </div>
  );
}

// ─── Step Timer ───────────────────────────────────────────────────
function StepTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        setFinished(true);
        // [边界处理] 计时器结束：振动 + 提示
        navigator.vibrate?.([200, 100, 200]);
        return 0;
      }
      return prev - 1;
    });
  }, []);

  function toggleTimer() {
    if (finished) {
      setRemaining(seconds);
      setFinished(false);
      return;
    }
    if (running) {
      clearInterval(intervalRef.current!);
      setRunning(false);
    } else {
      intervalRef.current = setInterval(tick, 1000);
      setRunning(true);
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Reset when seconds prop changes (step changed)
  useEffect(() => {
    clearInterval(intervalRef.current!);
    setRunning(false);
    setFinished(false);
    setRemaining(seconds);
  }, [seconds]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const displayTime = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}秒`;

  return (
    <div
      className={`flex items-center justify-between bg-[#FFF0EB] rounded-2xl px-4 py-3 ${
        finished ? 'timer-flash' : ''
      }`}
    >
      <div>
        <p className="text-xs text-gray-400 mb-0.5">计时器</p>
        <p className={`text-2xl font-bold tabular-nums ${finished ? 'text-green-500' : 'text-[#FF6B47]'}`}>
          {finished ? '✓ 完成！' : displayTime}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={toggleTimer}
          className="w-11 h-11 rounded-full bg-[#FF6B47] text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          {finished ? <RotateCcw size={18} /> : running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        {running && (
          <button
            onClick={() => {
              clearInterval(intervalRef.current!);
              setRunning(false);
              setRemaining(seconds);
            }}
            className="w-11 h-11 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center active:scale-90 transition-transform"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Feedback Modal ───────────────────────────────────────────────
const FEEDBACK_BAD_REASONS = [
  '咸了','淡了','太辣','太复杂','时间不对','食材不合适','步骤不清晰','其他',
];

function FeedbackModal({
  recipe, ingredients, fatigueLevel, onDone,
}: {
  recipe: Recipe;
  ingredients: string[];
  fatigueLevel: number;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<'good' | 'ok' | 'bad' | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');

  function toggleReason(r: string) {
    setReasons((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  function handleSubmit() {
    const record: HistoryRecord = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString(),
      recipeName: recipe.name,
      recipe,
      rating,
      feedback: (rating === 'ok' || rating === 'bad') ? { reasons, note } : undefined,
      ingredients,
      fatigueLevel: fatigueLevel as HistoryRecord['fatigueLevel'],
    };

    const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    storageSet(STORAGE_KEYS.HISTORY, [record, ...history].slice(0, 100));
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="w-full max-w-[480px] mx-auto bg-[#FAF7F2] rounded-t-3xl p-6 pb-10">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-bold text-[#2D2D2D] text-center mb-2">今天这道菜怎么样？</h2>
        <p className="text-gray-400 text-sm text-center mb-6">{recipe.name}</p>

        {/* Rating */}
        <div className="flex justify-center gap-6 mb-6">
          {(
            [
              { value: 'good', emoji: '😋', label: '好吃' },
              { value: 'ok', emoji: '😐', label: '一般' },
              { value: 'bad', emoji: '😞', label: '不好' },
            ] as const
          ).map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 min-w-[76px] transition-all active:scale-90 ${
                rating === value
                  ? 'border-[#FF6B47] bg-[#FFF0EB]'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-3xl">{emoji}</span>
              <span className={`text-xs font-medium ${rating === value ? 'text-[#FF6B47]' : 'text-gray-500'}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Secondary feedback for ok/bad */}
        {(rating === 'ok' || rating === 'bad') && (
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-[#2D2D2D]">哪里没达到预期？（选选看）</p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_BAD_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleReason(r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    reasons.includes(r)
                      ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="还有什么想说的…（选填）"
              rows={2}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-[#FF6B47]"
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!rating}
          className="w-full bg-[#FF6B47] disabled:opacity-40 text-white py-4 rounded-2xl font-semibold text-base active:scale-[0.98] transition-transform"
        >
          {rating ? '提交，回首页' : '先选个评价'}
        </button>
      </div>
    </div>
  );
}
