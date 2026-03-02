import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface TourState {
  seenPages: Record<string, boolean>;
  currentPage: string | null;
  currentStep: number;
  isActive: boolean;
  hasHydrated: boolean;
  isGloballyDisabled: boolean;
}

interface TourActions {
  startTour: (page: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  resetTour: () => void;
  markPageSeen: (page: string) => void;
  setHasHydrated: (value: boolean) => void;
  disableTourGlobally: () => void;
  enableTourGlobally: () => void;
}

export const useTourStore = create<TourState & TourActions>()(
  devtools(
    persist(
      (set, get) => ({
        seenPages: {},
        currentPage: null,
        currentStep: 0,
        isActive: false,
        hasHydrated: false,
        isGloballyDisabled: false,

        startTour: (page: string) => {
          const state = get();
          // 如果全局禁用，则不启动引导
          if (state.isGloballyDisabled) return;
          set({
            currentPage: page,
            currentStep: 0,
            isActive: true,
          });
        },

        nextStep: () => {
          set((state) => ({
            currentStep: state.currentStep + 1,
          }));
        },

        prevStep: () => {
          set((state) => ({
            currentStep: Math.max(0, state.currentStep - 1),
          }));
        },

        skipTour: () => {
          const state = get();
          if (state.currentPage) {
            set({
              isActive: false,
              seenPages: {
                ...state.seenPages,
                [state.currentPage]: true,
              },
            });
          }
        },

        resetTour: () => {
          set({
            seenPages: {},
            currentPage: null,
            currentStep: 0,
            isActive: false,
          });
        },

        markPageSeen: (page: string) => {
          set((state) => ({
            seenPages: {
              ...state.seenPages,
              [page]: true,
            },
          }));
        },

        setHasHydrated: (value: boolean) => {
          set({ hasHydrated: value });
        },

        disableTourGlobally: () => {
          set({
            isGloballyDisabled: true,
            isActive: false,
          });
        },

        enableTourGlobally: () => {
          set({
            isGloballyDisabled: false,
          });
        },
      }),
      {
        name: 'hasSeenTour',
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      }
    ),
    { name: 'TourStore' }
  )
);

// E2E 测试支持：通过 window 对象控制引导模式
// 在 e2e 测试中可以调用 window.__disableTourForE2E__() 来关闭引导
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__disableTourForE2E__ = () => {
    useTourStore.getState().disableTourGlobally();
    console.log('[Tour] 引导模式已禁用 (E2E 测试模式)');
  };
  
  (window as unknown as Record<string, unknown>).__enableTourForE2E__ = () => {
    useTourStore.getState().enableTourGlobally();
    console.log('[Tour] 引导模式已启用');
  };
  
  // 支持通过 localStorage 禁用引导（方便 e2e 测试初始化）
  const isTourDisabledByStorage = localStorage.getItem('TOUR_DISABLED_FOR_E2E');
  if (isTourDisabledByStorage === 'true') {
    useTourStore.getState().disableTourGlobally();
  }
}
