import { create } from 'zustand';
import type { DishSummary, FatigueLevel, FoodPreference, SelectedIngredient } from '@/types';

interface AppStore {
  // Session state — not persisted to localStorage
  selectedIngredients: SelectedIngredient[];
  fatigueLevel: FatigueLevel | null;
  foodPreference: FoodPreference;
  summariesMap: Record<string, DishSummary>;
  selectedRecipeId: string | null;
  excludedDishes: string[];
  retryCount: number;
  isLoading: boolean;
  error: string | null;
  p0Warning: string | null;
  currentCookingStep: number;
  doneRecipeIds: string[];
  recentlyUsedIngredientNames: string[];
  // 推荐会话 ID（由 /api/log-session 返回，用于关联 cooking_feedback）
  currentSessionId: string | null;

  // Derived convenience getter
  getIngredientNames: () => string[];

  setSelectedIngredients: (ings: SelectedIngredient[]) => void;
  addSelectedIngredient: (ing: SelectedIngredient) => void;
  removeSelectedIngredient: (名称: string) => void;
  setFatigueLevel: (level: FatigueLevel | null) => void;
  setFoodPreference: (pref: FoodPreference) => void;
  setSummaries: (summaries: DishSummary[]) => void;
  setSelectedRecipeId: (id: string | null) => void;
  addExcludedDish: (name: string) => void;
  clearExcluded: () => void;
  incrementRetry: () => void;
  resetRetry: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setP0Warning: (warning: string | null) => void;
  setCookingStep: (step: number) => void;
  addDoneRecipe: (id: string) => void;
  setRecentlyUsedIngredientNames: (names: string[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  resetSession: () => void;
  getSummaryById: (id: string) => DishSummary | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  selectedIngredients: [],
  fatigueLevel: null,
  foodPreference: 'default',
  summariesMap: {},
  selectedRecipeId: null,
  excludedDishes: [],
  retryCount: 0,
  isLoading: false,
  error: null,
  p0Warning: null,
  currentCookingStep: 0,
  doneRecipeIds: [],
  recentlyUsedIngredientNames: [],
  currentSessionId: null,

  getIngredientNames: () => get().selectedIngredients.map((i) => i.名称),

  setSelectedIngredients: (ings) => set({ selectedIngredients: ings }),

  addSelectedIngredient: (ing) =>
    set((state) => ({
      selectedIngredients: state.selectedIngredients.some((i) => i.名称 === ing.名称)
        ? state.selectedIngredients
        : [...state.selectedIngredients, ing],
    })),

  removeSelectedIngredient: (名称) =>
    set((state) => ({
      selectedIngredients: state.selectedIngredients.filter((i) => i.名称 !== 名称),
    })),

  setFatigueLevel: (level) => set({ fatigueLevel: level }),

  setFoodPreference: (pref) => set({ foodPreference: pref }),

  setSummaries: (summaries) => {
    const map: Record<string, DishSummary> = {};
    for (const s of summaries) map[s.id] = s;
    set({ summariesMap: map });
  },

  setSelectedRecipeId: (id) => set({ selectedRecipeId: id }),

  addExcludedDish: (name) =>
    set((state) => ({ excludedDishes: [...state.excludedDishes, name] })),

  clearExcluded: () => set({ excludedDishes: [] }),

  incrementRetry: () => set((state) => ({ retryCount: state.retryCount + 1 })),

  resetRetry: () => set({ retryCount: 0 }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setP0Warning: (warning) => set({ p0Warning: warning }),

  setCookingStep: (step) => set({ currentCookingStep: step }),

  addDoneRecipe: (id) =>
    set((state) => ({
      doneRecipeIds: state.doneRecipeIds.includes(id)
        ? state.doneRecipeIds
        : [...state.doneRecipeIds, id],
    })),

  setRecentlyUsedIngredientNames: (names) => set({ recentlyUsedIngredientNames: names }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  resetSession: () =>
    set({
      selectedIngredients: [],
      fatigueLevel: null,
      foodPreference: 'default',
      summariesMap: {},
      selectedRecipeId: null,
      excludedDishes: [],
      retryCount: 0,
      isLoading: false,
      error: null,
      p0Warning: null,
      currentCookingStep: 0,
      doneRecipeIds: [],
      recentlyUsedIngredientNames: [],
      currentSessionId: null,
    }),

  getSummaryById: (id) => get().summariesMap[id],
}));
