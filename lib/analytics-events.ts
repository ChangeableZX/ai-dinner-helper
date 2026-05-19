/**
 * 所有埋点事件的定义
 *
 * 命名规范: snake_case, 领域前缀, 动词在后
 */

import { track } from './analytics';

// === 页面访问 ===
export const trackPageView = (pageName: string, extra?: Record<string, unknown>) =>
  track('page_viewed', { page_name: pageName, ...extra });

// === Onboarding ===
export const trackOnboardingStarted = () => track('onboarding_started');
export const trackOnboardingCompleted = (durationMs: number) =>
  track('onboarding_completed', { duration_ms: durationMs });
export const trackOnboardingStepCompleted = (step: number, stepName: string) =>
  track('onboarding_step_completed', { step, step_name: stepName });

// === 食材库 ===
export const trackInventoryItemAdded = (source: string, category: string) =>
  track('inventory_item_added', { source, category });
export const trackInventoryItemUsedUp = (category: string) =>
  track('inventory_item_used_up', { category });
export const trackOrderRecognized = (itemCount: number, hasError: boolean) =>
  track('order_recognized', { item_count: itemCount, has_error: hasError });
export const trackOrderRecognitionConfirmed = (
  ingredientCount: number,
  seasoningCount: number,
) =>
  track('order_recognition_confirmed', {
    ingredient_count: ingredientCount,
    seasoning_count: seasoningCount,
  });

// === 推荐 ===
export const trackRecommendStarted = (ingredientsCount: number, fatigueLevel: number) =>
  track('recommend_started', { ingredients_count: ingredientsCount, fatigue_level: fatigueLevel });
export const trackRecommendCompleted = (durationMs: number, dishCount: number) =>
  track('recommend_completed', { duration_ms: durationMs, dish_count: dishCount });
export const trackRecommendFailed = (durationMs: number, errorType: string) =>
  track('recommend_failed', { duration_ms: durationMs, error_type: errorType });
export const trackRecommendRegenerated = (regenerateCount: number) =>
  track('recommend_regenerated', { regenerate_count: regenerateCount });

// === 用户决策 ===
export const trackDishSelected = (dishName: string, dishIndex: number) =>
  track('dish_selected', { dish_name: dishName, dish_index: dishIndex });
export const trackRecipeDetailViewed = (dishName: string, fromCache: boolean) =>
  track('recipe_detail_viewed', { dish_name: dishName, from_cache: fromCache });

// === 烹饪 ===
export const trackCookingStarted = (dishName: string) =>
  track('cooking_started', { dish_name: dishName });
export const trackCookingStepCompleted = (dishName: string, stepIndex: number) =>
  track('cooking_step_completed', { dish_name: dishName, step_index: stepIndex });
export const trackCookingAbandoned = (
  dishName: string,
  completedSteps: number,
  totalSteps: number,
) =>
  track('cooking_abandoned', {
    dish_name: dishName,
    completed_steps: completedSteps,
    total_steps: totalSteps,
  });

// === 反馈 ===
export const trackFeedbackSubmitted = (
  dishName: string,
  rating: string,
  hasIssue: boolean,
) =>
  track('feedback_submitted', { dish_name: dishName, rating, has_issue: hasIssue });
export const trackFeedbackSkipped = (dishName: string) =>
  track('feedback_skipped', { dish_name: dishName });

// === 错误 ===
export const trackError = (context: string, errorMessage: string) =>
  track('error_occurred', {
    context,
    error_message: errorMessage.substring(0, 200),
  });
