import React, { memo, useEffect, useMemo, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

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
  onCancel?: () => void;
  tips?: readonly string[];
}

const STUCK_THRESHOLD_MS = 15 * 1000;
const TIP_ROTATION_MS = 4000;

const ImagePullProgressOverlay = memo(({ show, imagePullProgress, onRefresh, onCancel, tips }: Props) => {
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [stuckSeconds, setStuckSeconds] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const progressFingerprint = useMemo(() => {
    if (!imagePullProgress) return '';
    return [
      imagePullProgress.status ?? '',
      imagePullProgress.progress ?? '',
      imagePullProgress.progressPercent?.toString() ?? '',
      imagePullProgress.error ?? '',
    ].join('|');
  }, [imagePullProgress]);

  const visibleTips = useMemo(() => {
    return (tips ?? []).filter((tip) => tip.trim().length > 0);
  }, [tips]);

  useEffect(() => {
    if (!show) {
      setStuckSeconds(0);
      setTipIndex(0);
      return;
    }
    setLastActivityAt(Date.now());
    setStuckSeconds(0);
  }, [progressFingerprint, show]);

  useEffect(() => {
    if (!show || visibleTips.length <= 1) return;

    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % visibleTips.length);
    }, TIP_ROTATION_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [show, visibleTips.length]);

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
  const progressScale = percent != null ? Math.max(0, Math.min(100, percent)) / 100 : null;
  const currentTip = visibleTips.length > 0 ? visibleTips[tipIndex % visibleTips.length] : null;

  return (
    <div className="image-pull-overlay absolute inset-0 bg-[var(--color-bg-primary)]/95 flex items-center justify-center z-50 transition-all duration-300">
      <div className="image-pull-card relative bg-[var(--color-bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4 border border-[var(--color-border-default)] shadow-lg">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]"
            aria-label="取消镜像拉取"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <div className="text-center">
          <div className="mb-4">
            <div className="image-pull-activity relative inline-flex items-center justify-center w-12 h-12 bg-[var(--color-accent-primary)]/10 rounded-full mb-3">
              <span className="image-pull-activity-halo absolute inset-0 rounded-full border border-[var(--color-accent-border)]" aria-hidden="true"></span>
              <svg className="image-pull-spinner relative w-6 h-6 text-[var(--color-accent-primary)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

              <div className="image-pull-progress-track relative w-full bg-[var(--color-bg-tertiary)] rounded-full h-1.5 overflow-hidden">
                {progressScale != null ? (
                  <div className="image-pull-progress-fill bg-[var(--color-accent-primary)] h-full rounded-full transition-transform duration-300 origin-left" style={{ transform: `scaleX(${progressScale})` }}></div>
                ) : (
                  <div className="image-pull-progress-indeterminate bg-[var(--color-accent-primary)] h-full rounded-full"></div>
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
              {currentTip && (
                <div
                  key={tipIndex}
                  className="image-pull-tip flex items-start gap-2 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-3 py-2 text-left text-xs text-[var(--color-text-secondary)]"
                  role="status"
                  aria-live="polite"
                  data-testid="image-pull-tip"
                >
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                  <div className="min-w-0 leading-5">
                    <span className="font-medium text-[var(--color-text-primary)]">小提示：</span>
                    <span>{currentTip}</span>
                  </div>
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
