import React, { useEffect, useState, useRef, useCallback } from 'react';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourTooltipProps {
  isOpen: boolean;
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export const TourTooltip: React.FC<TourTooltipProps> = ({
  isOpen,
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!isOpen || !step.targetId) return;
    
    const target = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step.targetId]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onSkip();
          break;
        case 'ArrowRight':
          if (currentStep < totalSteps - 1) onNext();
          break;
        case 'ArrowLeft':
          if (currentStep > 0) onPrev();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, totalSteps, onNext, onPrev, onSkip]);

  if (!isOpen || !targetRect) return null;

  const getTooltipStyle = () => {
    if (!targetRect) return {};
    
    const gap = 12;
    const position = step.position || 'bottom';
    const tooltipWidth = 320; // w-80 = 320px
    const tooltipHeight = 200; // 估算 tooltip 高度
    const padding = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 60,
    };

    // 边界检测：检测是否需要调整位置
    let adjustedPosition = position;
    
    // 检测右侧溢出
    const wouldOverflowRight = (left: number) => left + tooltipWidth + padding > viewportWidth;
    // 检测左侧溢出
    const wouldOverflowLeft = (left: number) => left - tooltipWidth - padding < 0;
    // 检测底部溢出
    const wouldOverflowBottom = (top: number) => top + tooltipHeight + padding > viewportHeight;
    // 检测顶部溢出
    const wouldOverflowTop = (top: number) => top - tooltipHeight - padding < 0;

    switch (position) {
      case 'top':
        style.top = `${targetRect.top - gap}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translate(-50%, -100%)';
        
        // 检测溢出并调整
        if (wouldOverflowTop(targetRect.top - gap - tooltipHeight)) {
          // 顶部空间不足，改为底部
          adjustedPosition = 'bottom';
        } else if (wouldOverflowLeft(parseFloat(style.left!) - tooltipWidth / 2)) {
          // 左侧空间不足，调整 left
          style.left = `${padding + tooltipWidth / 2}px`;
        } else if (wouldOverflowRight(parseFloat(style.left!) + tooltipWidth / 2)) {
          // 右侧空间不足，调整 left
          style.left = `${viewportWidth - padding - tooltipWidth / 2}px`;
        }
        break;
      case 'bottom':
        style.top = `${targetRect.bottom + gap}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translate(-50%, 0)';
        
        // 检测溢出并调整
        if (wouldOverflowBottom(targetRect.bottom + gap + tooltipHeight)) {
          // 底部空间不足，改为顶部
          adjustedPosition = 'top';
        } else if (wouldOverflowLeft(parseFloat(style.left!) - tooltipWidth / 2)) {
          // 左侧空间不足，调整 left
          style.left = `${padding + tooltipWidth / 2}px`;
        } else if (wouldOverflowRight(parseFloat(style.left!) + tooltipWidth / 2)) {
          // 右侧空间不足，改为左侧显示
          adjustedPosition = 'left';
        }
        break;
      case 'left':
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.left = `${targetRect.left - gap}px`;
        style.transform = 'translate(-100%, -50%)';
        
        // 检测溢出并调整
        if (wouldOverflowLeft(targetRect.left - gap - tooltipWidth)) {
          // 左侧空间不足，改为右侧
          adjustedPosition = 'right';
        } else if (wouldOverflowTop(parseFloat(style.top!) - tooltipHeight / 2)) {
          style.top = `${padding + tooltipHeight / 2}px`;
        } else if (wouldOverflowBottom(parseFloat(style.top!) + tooltipHeight / 2)) {
          style.top = `${viewportHeight - padding - tooltipHeight / 2}px`;
        }
        break;
      case 'right': {
        const rightCenterTop = targetRect.top + targetRect.height / 2;
        style.left = `${targetRect.right + gap}px`;
        style.transform = 'translate(0, -50%)';
        
        if (wouldOverflowRight(targetRect.right + gap + tooltipWidth)) {
          adjustedPosition = 'left';
        }
        
        const topOverflows = rightCenterTop - tooltipHeight / 2 < padding;
        const bottomOverflows = rightCenterTop + tooltipHeight / 2 > viewportHeight - padding;
        
        if (topOverflows && !bottomOverflows) {
          style.top = `${padding + tooltipHeight / 2}px`;
          style.transform = 'translate(0, 0)';
        } else if (bottomOverflows && !topOverflows) {
          style.top = `${viewportHeight - padding - tooltipHeight / 2}px`;
          style.transform = 'translate(0, -100%)';
        } else if (topOverflows && bottomOverflows) {
          style.top = `${viewportHeight / 2}px`;
          style.transform = 'translate(0, -50%)';
        } else {
          style.top = `${rightCenterTop}px`;
        }
        break;
      }
    }

    // 应用调整后的位置样式
    if (adjustedPosition !== position) {
      switch (adjustedPosition) {
        case 'top':
          style.top = `${targetRect.top - gap}px`;
          style.left = `${targetRect.left + targetRect.width / 2}px`;
          style.transform = 'translate(-50%, -100%)';
          break;
        case 'bottom':
          style.top = `${targetRect.bottom + gap}px`;
          style.left = `${targetRect.left + targetRect.width / 2}px`;
          style.transform = 'translate(-50%, 0)';
          break;
        case 'left':
          style.top = `${targetRect.top + targetRect.height / 2}px`;
          style.left = `${targetRect.left - gap}px`;
          style.transform = 'translate(-100%, -50%)';
          break;
        case 'right':
          style.top = `${targetRect.top + targetRect.height / 2}px`;
          style.left = `${targetRect.right + gap}px`;
          style.transform = 'translate(0, -50%)';
          break;
      }
    }

    return style;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="tour-tooltip">

      <div
        className="fixed z-50 pointer-events-none transition-all duration-300 ease-in-out border-2 border-blue-500 rounded-md"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      <div
        ref={tooltipRef}
        className={cn(
          "w-80 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl p-4 animate-scale-in",
          "flex flex-col gap-3"
        )}
        style={getTooltipStyle()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[var(--color-text-primary)]">
            {step.title}
          </h3>
          <button 
            onClick={onSkip}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close tour"
            data-testid="tour-close-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)]">
          {step.content}
        </p>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border-default)]">
          <div className="text-xs text-[var(--color-text-secondary)]">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                data-testid="tour-prev-btn"
              >
                Prev
              </button>
            )}
            <button
              onClick={currentStep === totalSteps - 1 ? onSkip : onNext}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded transition-colors"
              data-testid={currentStep === totalSteps - 1 ? 'tour-finish-btn' : 'tour-next-btn'}
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
