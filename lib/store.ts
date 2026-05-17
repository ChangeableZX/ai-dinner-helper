import { create } from 'zustand';
import type { Recipe, FatigueLevel, FoodPreference, SelectedIngredient } from '@/types';

interface AppStore {
  // Session state — not persisted to localStorage
  selectedIngredients: SelectedIngredient[];
  fatigueLevel: FatigueLevel | null;
  foodPreference: FoodPreference;
  recipesMap: Record<string, Recipe>;
  selectedRecipeId: string | null;
  excludedDishes: string[];
  retryCount: number;
  isLoading: boolean;
  error: string | null;
  p0Warning: string | null;
  currentCookingStep: number;

  // Derived convenience getter
  getIngredientNames: () => string[];

  setSelectedIngredients: (ings: SelectedIngredient[]) => void;
  addSelectedIngredient: (ing: SelectedIngredient) => void;
  removeSelectedIngredient: (名称: string) => void;
  setFatigueLevel: (level: FatigueLevel | null) => void;
  setFoodPreference: (pref: FoodPreference) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setSelectedRecipeId: (id: string | null) => void;
  addExcludedDish: (name: string) => void;
  clearExcluded: () => void;
  incrementRetry: () => void;
  resetRetry: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setP0Warning: (warning: string | null) => void;
  setCookingStep: (step: number) => void;
  resetSession: () => void;
  getRecipeById: (id: string) => Recipe | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  selectedIngredients: [],
  fatigueLevel: null,
  foodPreference: 'default',
  recipesMap: {},
  selectedRecipeId: null,
  excludedDishes: [],
  retryCount: 0,
  isLoading: false,
  error: null,
  p0Warning: null,
  currentCookingStep: 0,

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

  setRecipes: (recipes) => {
    const map: Record<string, Recipe> = {};
    for (const r of recipes) map[r.id] = r;
    set({ recipesMap: map });
  },

  setSelectedRecipeId: (id) => set({ selectedRecipeId: id }),

  addExcludedDish: (name) =>
    set((state) => ({ excludedDishes: [...state.excludedDishes, name] })),

  clearExcluded: () => set({ excludedDishes: [] }),

  incrementRetry: () =>
    set((state) => ({ retryCount: state.retryCount + 1 })),

  resetRetry: () => set({ retryCount: 0 }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setP0Warning: (warning) => set({ p0Warning: warning }),

  setCookingStep: (step) => set({ currentCookingStep: step }),

  resetSession: () =>
    set({
      selectedIngredients: [],
      fatigueLevel: null,
      foodPreference: 'default',
      recipesMap: {},
      selectedRecipeId: null,
      excludedDishes: [],
      retryCount: 0,
      isLoading: false,
      error: null,
      p0Warning: null,
      currentCookingStep: 0,
    }),

  getRecipeById: (id) => get().recipesMap[id],
}));
