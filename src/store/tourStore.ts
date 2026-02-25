import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface TourState {
  seenPages: Record<string, boolean>;
  currentPage: string | null;
  currentStep: number;
  isActive: boolean;
  hasHydrated: boolean;
}

interface TourActions {
  startTour: (page: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  resetTour: () => void;
  markPageSeen: (page: string) => void;
  setHasHydrated: (value: boolean) => void;
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

        startTour: (page: string) => {
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
