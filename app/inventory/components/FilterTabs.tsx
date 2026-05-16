'use client';

export type FilterTab = '全部' | '新鲜' | '该吃了' | '可能过期';

const TABS: FilterTab[] = ['全部', '新鲜', '该吃了', '可能过期'];

interface FilterTabsProps {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

export default function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
            active === tab
              ? 'bg-[#FF6B47] text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
