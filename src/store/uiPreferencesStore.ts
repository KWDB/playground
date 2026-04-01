import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIPreferencesState {
  courseViewMode: 'grid' | 'list';
}

interface UIPreferencesActions {
  setCourseViewMode: (mode: 'grid' | 'list') => void;
}

export const useUIPreferencesStore = create<UIPreferencesState & UIPreferencesActions>()(
  devtools(
    persist(
      (set) => ({
        courseViewMode: 'grid',

        setCourseViewMode: (courseViewMode) => set({ courseViewMode }),
      }),
      {
        name: 'ui-preferences',
      }
    ),
    { name: 'UIPreferencesStore' }
  )
);