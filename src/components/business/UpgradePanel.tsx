import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';

type UpgradeCheck = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  canUpgrade: boolean;
  message: string;
  dockerDeploy: boolean;
};

export default function UpgradePanel({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const [version, setVersion] = useState<string>('dev');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [upgradeCheck, setUpgradeCheck] = useState<UpgradeCheck | null>(null);
  const [upgradeCheckLoading, setUpgradeCheckLoading] = useState(false);
  const [upgradeCheckError, setUpgradeCheckError] = useState<string | null>(null);

  const loadVersion = async () => {
    try {
      const resp = await fetch('/api/version');
      if (resp.ok) {
        const json = await resp.json();
        setVersion(json.version || 'dev');
      }
    } catch {
      setVersion('dev');
    }
  };

  const startUpgrade = async () => {
    setUpgradeLoading(true);
    setUpgradeError(null);
    setUpgradeMessage(null);
    try {
      const resp = await fetch('/api/upgrade', { method: 'POST' });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || '升级失败');
      }
      setUpgradeMessage(json.message || '升级已开始，服务即将重启');
    } catch (e: unknown) {
      setUpgradeError(e instanceof Error ? e.message : '升级失败');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const loadUpgradeCheck = async () => {
    setUpgradeCheckLoading(true);
    setUpgradeCheckError(null);
    try {
      const resp = await fetch('/api/upgrade/check');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || '检查更新失败');
      }
      setUpgradeCheck(json as UpgradeCheck);
    } catch (e: unknown) {
      setUpgradeCheckError(e instanceof Error ? e.message : '检查更新失败');
    } finally {
      setUpgradeCheckLoading(false);
    }
  };

  useEffect(() => {
    loadVersion();
    loadUpgradeCheck();
  }, []);

  return (
    <>
      <div className="w-full bg-[var(--color-bg-primary)] rounded-lg shadow-lg border border-[var(--color-border-light)]">
        <div className={`transition-all duration-300 overflow-hidden ${alwaysExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">版本与升级</p>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>当前版本 v{version}</span>
                  {upgradeCheck?.hasUpdate && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium">
                      有新版本
                    </span>
                  )}
                  {upgradeCheck && !upgradeCheck.hasUpdate && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] font-medium">
                      已是最新
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadUpgradeCheck}
                  disabled={upgradeCheckLoading}
                  className="gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${upgradeCheckLoading ? 'animate-spin' : ''}`} />
                  {upgradeCheckLoading ? '检查中' : '检查更新'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUpgradeConfirm(true)}
                  disabled={upgradeLoading || !!upgradeMessage || !upgradeCheck?.canUpgrade}
                  className="gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${upgradeLoading ? 'animate-spin' : ''}`} />
                  {upgradeLoading ? '升级中' : '立即升级'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-3 py-2 space-y-1">
              {upgradeCheck && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">最新版本</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium">
                    v{upgradeCheck.latestVersion}
                  </span>
                  <span className="text-[var(--color-text-tertiary)]">·</span>
                  <span>{upgradeCheck.message}</span>
                </div>
              )}
              {upgradeCheckError && (
                <p className="text-xs text-[var(--color-error)]">{upgradeCheckError}</p>
              )}
              {upgradeMessage && (
                <p className="text-xs text-[var(--color-accent-primary)]">{upgradeMessage}</p>
              )}
              {upgradeError && (
                <p className="text-xs text-[var(--color-error)]">{upgradeError}</p>
              )}
              {!upgradeCheck && upgradeCheckLoading && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>正在获取最新版本信息…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showUpgradeConfirm}
        title="确认升级"
        message="升级将自动下载最新版本并重启服务，期间页面可能短暂不可用。是否继续？"
        confirmText="开始升级"
        cancelText="取消"
        onConfirm={() => {
          setShowUpgradeConfirm(false);
          startUpgrade();
        }}
        onCancel={() => setShowUpgradeConfirm(false)}
        variant="warning"
      />
    </>
  );
}
