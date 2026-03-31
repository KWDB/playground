import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { navbarButtonStyles } from '@/components/layout/navbarButtonStyles';

type UpgradeCheck = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  canUpgrade: boolean;
  message: string;
  dockerDeploy: boolean;
};

interface UpgradeButtonProps {
  onClick: () => void;
}

export default function UpgradeButton({ onClick }: UpgradeButtonProps) {
  const [version, setVersion] = useState<string>('dev');
  const [upgradeCheck, setUpgradeCheck] = useState<UpgradeCheck | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const [versionResp, upgradeResp] = await Promise.all([
          fetch('/api/version', { signal: controller.signal }),
          fetch('/api/upgrade/check', { signal: controller.signal }),
        ]);

        if (versionResp.ok) {
          const versionJson = await versionResp.json();
          setVersion(versionJson.version || 'dev');
        }

        if (upgradeResp.ok) {
          const upgradeJson = await upgradeResp.json();
          setUpgradeCheck(upgradeJson);
        }
      } catch (err) {
        console.error('Failed to check version:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const hasUpgrade = !!upgradeCheck?.hasUpdate;

  return (
    <button
      onClick={onClick}
      className={cn(
        navbarButtonStyles.statusButton,
        'cursor-pointer'
      )}
      aria-haspopup="dialog"
      aria-controls="upgrade-modal"
    >
      <span className={`text-xs ${hasUpgrade ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-tertiary)]'}`}>
        v{version}
      </span>
      {hasUpgrade && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium">
          有更新
        </span>
      )}
      {loading && (
        <span className="text-xs text-[var(--color-text-tertiary)]">检查中</span>
      )}
    </button>
  );
}
