import { create } from 'zustand';
import type { Recipe, FatigueLevel } from '@/types';

interface AppStore {
  // Session state — not persisted to localStorage
  ingredients: string[];
  fatigueLevel: FatigueLevel | null;
  recipesMap: Record<string, Recipe>;
  selectedRecipeId: string | null;
  excludedDishes: string[];
  retryCount: number;
  isLoading: boolean;
  error: string | null;
  p0Warning: string | null;
  currentCookingStep: number;

  setIngredients: (ingredients: string[]) => void;
  addIngredient: (ingredient: string) => void;
  removeIngredient: (ingredient: string) => void;
  setFatigueLevel: (level: FatigueLevel | null) => void;
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
  ingredients: [],
  fatigueLevel: null,
  recipesMap: {},
  selectedRecipeId: null,
  excludedDishes: [],
  retryCount: 0,
  isLoading: false,
  error: null,
  p0Warning: null,
  currentCookingStep: 0,

  setIngredients: (ingredients) => set({ ingredients }),

  addIngredient: (ingredient) =>
    set((state) => ({
      ingredients: state.ingredients.includes(ingredient)
        ? state.ingredients
        : [...state.ingredients, ingredient],
    })),

  removeIngredient: (ingredient) =>
    set((state) => ({
      ingredients: state.ingredients.filter((i) => i !== ingredient),
    })),

  setFatigueLevel: (level) => set({ fatigueLevel: level }),

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
      ingredients: [],
      fatigueLevel: null,
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
