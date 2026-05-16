'use client';

interface EmptyStateProps {
  onAdd: () => void;
  onUpload: () => void;
}

export default function EmptyState({ onAdd, onUpload }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-7xl mb-5">🥶</div>
      <p className="text-xl font-bold text-[#2D2D2D] mb-2">你的冰箱空空如也</p>
      <p className="text-sm text-gray-400 mb-8 leading-relaxed">
        上传一张订单截图，几秒钟建好你的食材库
      </p>
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={onUpload}
          className="flex-1 py-3 rounded-2xl bg-[#FF6B47] text-white text-sm font-semibold active:scale-[0.98] transition-transform shadow-md shadow-[#FF6B47]/30"
        >
          📸 上传订单
        </button>
        <button
          onClick={onAdd}
          className="flex-1 py-3 rounded-2xl border-2 border-[#FF6B47] text-[#FF6B47] text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          手动添加
        </button>
      </div>
    </div>
  );
}
