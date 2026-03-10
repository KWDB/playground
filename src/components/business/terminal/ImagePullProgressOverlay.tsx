import React, { memo, useEffect, useMemo, useState } from 'react';

export interface ImagePullProgressMessageOverlay {
  imageName: string;
  status?: string;
  progress?: string;
  error?: string;
  progressPercent?: number;
}

interface Props {
  show: boolean;
  imagePullProgress: ImagePullProgressMessageOverlay | null;
  onRefresh?: () => void;
}

const STUCK_THRESHOLD_MS = 15 * 1000;

const ImagePullProgressOverlay = memo(({ show, imagePullProgress, onRefresh }: Props) => {
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [stuckSeconds, setStuckSeconds] = useState(0);

  const progressFingerprint = useMemo(() => {
    if (!imagePullProgress) return '';
    return [
      imagePullProgress.status ?? '',
      imagePullProgress.progress ?? '',
      imagePullProgress.progressPercent?.toString() ?? '',
      imagePullProgress.error ?? '',
    ].join('|');
  }, [imagePullProgress]);

  useEffect(() => {
    if (!show) {
      setStuckSeconds(0);
      return;
    }
    setLastActivityAt(Date.now());
    setStuckSeconds(0);
  }, [progressFingerprint, show]);

  useEffect(() => {
    if (!show || !imagePullProgress || imagePullProgress.error) {
      setStuckSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      const elapsedMs = Date.now() - lastActivityAt;
      if (elapsedMs >= STUCK_THRESHOLD_MS) {
        setStuckSeconds(Math.floor(elapsedMs / 1000));
      } else {
        setStuckSeconds(0);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [imagePullProgress, lastActivityAt, show]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    window.location.reload();
  };

  if (!show || !imagePullProgress) return null;

  const isStuck = stuckSeconds > 0;
  const percent = imagePullProgress.progressPercent;
  const widthStyle = percent != null ? { width: `${Math.max(0, Math.min(100, percent))}%` } : undefined;

  return (
    <div className="absolute inset-0 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4 border border-[var(--color-border-default)] shadow-lg">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--color-accent-primary)]/10 rounded-full mb-3">
              <svg className="w-6 h-6 text-[var(--color-accent-primary)] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">正在拉取镜像</h3>
            <p className="text-[var(--color-text-secondary)] text-sm break-all">{imagePullProgress.imageName}</p>
          </div>
          
          {imagePullProgress.error ? (
            <div className="text-[var(--color-error)] text-sm bg-[var(--color-error-subtle)] rounded-lg p-3 border border-[var(--color-error)]">
              <div className="font-medium mb-1">拉取失败</div>
              <div className="text-xs opacity-80">{imagePullProgress.error}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {imagePullProgress.status && (
                <div className="text-[var(--color-accent-primary)] text-sm font-medium">
                  {imagePullProgress.status} {percent != null && <span className="ml-1 text-[var(--color-text-secondary)]">({percent}%)</span>}
                </div>
              )}
              {imagePullProgress.progress && (
                <div className="text-[var(--color-text-tertiary)] text-xs font-mono bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  {imagePullProgress.progress}
                </div>
              )}

              <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-1.5 overflow-hidden">
                {percent != null ? (
                  <div className="bg-[var(--color-accent-primary)] h-full rounded-full transition-all duration-200" style={widthStyle}></div>
                ) : (
                  <div className="bg-[var(--color-accent-primary)] h-full rounded-full animate-pulse"></div>
                )}
              </div>
              {isStuck && (
                <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-center">
                  <div className="text-sm text-[var(--color-warning)] font-medium">拉取可能卡住（{stuckSeconds}s 未更新）</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">可点击刷新按钮重新同步状态</div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="btn btn-ghost text-xs mt-3 mx-auto block"
                  >
                    刷新
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
  );
});

ImagePullProgressOverlay.displayName = 'ImagePullProgressOverlay';

export default ImagePullProgressOverlay;
