import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';

// 缓存 key 和有效期
const UPGRADE_CHECK_CACHE_KEY = 'kwdb_upgrade_check';
const UPGRADE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 小时

type UpgradeCheck = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  canUpgrade: boolean;
  message: string;
  dockerDeploy: boolean;
};

// 缓存类型
type CachedUpgradeCheck = {
  data: UpgradeCheck;
  timestamp: number;
};

// 获取缓存
const getCachedUpgradeCheck = (): UpgradeCheck | null => {
  try {
    const cached = localStorage.getItem(UPGRADE_CHECK_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: CachedUpgradeCheck = JSON.parse(cached);
    if (Date.now() - timestamp > UPGRADE_CACHE_DURATION) {
      localStorage.removeItem(UPGRADE_CHECK_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

// 设置缓存
const setCachedUpgradeCheck = (data: UpgradeCheck) => {
  try {
    const cached: CachedUpgradeCheck = { data, timestamp: Date.now() };
    localStorage.setItem(UPGRADE_CHECK_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // 忽略缓存错误
  }
};

export default function UpgradePanel({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const [version, setVersion] = useState<string>('dev');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [upgradeStage, setUpgradeStage] = useState<'idle' | 'in_progress' | 'success'>('idle');
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [upgradeCheck, setUpgradeCheck] = useState<UpgradeCheck | null>(null);
  const [upgradeCheckLoading, setUpgradeCheckLoading] = useState(false);
  const [upgradeCheckError, setUpgradeCheckError] = useState<string | null>(null);
  const unmountedRef = useRef(false);

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

  const waitForServiceRestore = async () => {
    const deadline = Date.now() + 90 * 1000;
    while (Date.now() < deadline) {
      try {
        const healthResp = await fetch('/health', { cache: 'no-store' });
        if (healthResp.ok) {
          return true;
        }
      } catch (error) {
        void error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  };

  const startUpgrade = async () => {
    setUpgradeLoading(true);
    setUpgradeError(null);
    setUpgradeMessage(null);
    setUpgradeStage('in_progress');
    try {
      const resp = await fetch('/api/upgrade', { method: 'POST' });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || '升级失败');
      }
      setUpgradeMessage(json.message || '升级已开始，服务即将重启');
      const restored = await waitForServiceRestore();
      if (unmountedRef.current) return;
      if (restored) {
        await Promise.all([loadVersion(), loadUpgradeCheck(true)]);
        if (unmountedRef.current) return;
        setUpgradeStage('success');
        setUpgradeMessage('升级成功，服务已恢复');
      } else {
        setUpgradeStage('idle');
        setUpgradeMessage('升级已触发，服务重启时间较长，请稍后刷新页面确认');
      }
    } catch (e: unknown) {
      setUpgradeError(e instanceof Error ? e.message : '升级失败');
      setUpgradeStage('idle');
    } finally {
      if (!unmountedRef.current) {
        setUpgradeLoading(false);
      }
    }
  };

  const loadUpgradeCheck = async (forceRefresh = false) => {
    // 如果不是强制刷新，先尝试使用缓存
    if (!forceRefresh) {
      const cached = getCachedUpgradeCheck();
      if (cached) {
        setUpgradeCheck(cached);
        return;
      }
    }

    setUpgradeCheckLoading(true);
    setUpgradeCheckError(null);
    try {
      const resp = await fetch('/api/upgrade/check');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // 简化错误信息，不显示具体原因
        throw new Error('检查更新失败，请稍后重试');
      }
      setUpgradeCheck(json as UpgradeCheck);
      // 缓存结果
      setCachedUpgradeCheck(json as UpgradeCheck);
    } catch (e: unknown) {
      // 如果有缓存，显示缓存数据，不显示错误
      const cached = getCachedUpgradeCheck();
      if (cached) {
        setUpgradeCheck(cached);
        return;
      }
      setUpgradeCheckError(e instanceof Error ? e.message : '检查更新失败，请稍后重试');
    } finally {
      setUpgradeCheckLoading(false);
    }
  };

  useEffect(() => {
    loadVersion();
    loadUpgradeCheck();
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const isUpgradeInProgress = upgradeLoading || upgradeStage === 'in_progress';

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
                  onClick={() => loadUpgradeCheck(true)}
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
                  disabled={isUpgradeInProgress || !upgradeCheck?.canUpgrade}
                  className="gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpgradeInProgress ? 'animate-spin' : ''}`} />
                  {isUpgradeInProgress ? '升级中' : '立即升级'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-3 py-2 space-y-1">
              {upgradeStage === 'in_progress' && (
                <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span className="font-medium">正在升级，服务即将自动重启</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] text-pretty">
                    正在下载并替换最新版本，页面可能短暂不可用。请保持当前页面开启，升级完成后会自动提示。
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div className="h-full w-full rounded-full bg-[var(--color-accent-primary)] animate-pulse" />
                  </div>
                </div>
              )}
              {upgradeStage === 'success' && (
                <div className="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success-subtle)] p-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
                    <CheckCircle2 className="size-3.5" />
                    <span className="font-medium">升级成功，服务已恢复</span>
                  </div>
                </div>
              )}
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
