import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const UPGRADE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 小时

export type UpgradeCheck = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  canUpgrade: boolean;
  message: string;
  dockerDeploy: boolean;
};

interface UpgradeState {
  cachedData: UpgradeCheck | null;
  cachedAt: number | null;
}

interface UpgradeActions {
  getCachedUpgradeCheck: () => UpgradeCheck | null;
  setCachedUpgradeCheck: (data: UpgradeCheck) => void;
  clearCache: () => void;
}

export const useUpgradeStore = create<UpgradeState & UpgradeActions>()(
  devtools(
    persist(
      (set, get) => ({
        cachedData: null,
        cachedAt: null,

        getCachedUpgradeCheck: () => {
          const { cachedData, cachedAt } = get();
          if (!cachedData || !cachedAt) return null;
          if (Date.now() - cachedAt > UPGRADE_CACHE_DURATION) {
            set({ cachedData: null, cachedAt: null });
            return null;
          }
          return cachedData;
        },

        setCachedUpgradeCheck: (data: UpgradeCheck) => {
          set({ cachedData: data, cachedAt: Date.now() });
        },

        clearCache: () => {
          set({ cachedData: null, cachedAt: null });
        },
      }),
      {
        name: 'upgrade-storage',
      }
    ),
    { name: 'UpgradeStore' }
  )
);