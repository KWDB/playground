import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

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
  if (typeof document === 'undefined') return null;

  const getTooltipStyle = () => {
    if (!targetRect) return {};
    
    const gap = 12;
    const padding = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get actual tooltip dimensions after render
    const tooltipWidth = tooltipRef.current?.offsetWidth || 320;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 150;
    
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 60,
    };

    // Helper functions
    const wouldOverflowRight = (left: number) => left + tooltipWidth > viewportWidth - padding;
    const wouldOverflowLeft = (left: number) => left < padding;
    const wouldOverflowBottom = (top: number) => top + tooltipHeight > viewportHeight - padding;
    const wouldOverflowTop = (top: number) => top < padding;
    
    // Try positions in order of preference
    const positions: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
    const preferredPosition = step.position || 'bottom';
    
    // Reorder to try preferred first
    const tryOrder = [preferredPosition, ...positions.filter(p => p !== preferredPosition)];
    
    let positioned = false;
    for (const pos of tryOrder) {
      let left: number, top: number;
      
      switch (pos) {
        case 'top':
          left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
          top = targetRect.top - tooltipHeight - gap;
          break;
        case 'bottom':
          left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
          top = targetRect.bottom + gap;
          break;
        case 'left':
          left = targetRect.left - tooltipWidth - gap;
          top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
          break;
        case 'right':
          left = targetRect.right + gap;
          top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
          break;
      }
      
      if (!wouldOverflowLeft(left) && !wouldOverflowRight(left) && 
          !wouldOverflowTop(top) && !wouldOverflowBottom(top)) {
        style.left = `${left}px`;
        style.top = `${top}px`;
        positioned = true;
        break;
      }
    }
    
    // Fallback: force within bounds
    if (!positioned) {
      let left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
      let top = targetRect.bottom + gap;
      
      if (wouldOverflowLeft(left)) left = padding;
      if (wouldOverflowRight(left)) left = viewportWidth - tooltipWidth - padding;
      if (wouldOverflowTop(top)) top = targetRect.top - tooltipHeight - gap;
      if (wouldOverflowBottom(top)) top = viewportHeight - tooltipHeight - padding;
      
      style.left = `${left}px`;
      style.top = `${top}px`;
    }

    return style;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="tour-tooltip">

      <div
        className="fixed z-50 pointer-events-none transition-all duration-300 ease-in-out border-2 border-[var(--color-accent-primary)] rounded-md"
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
          "w-80 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] shadow-[var(--shadow-lg)] p-4 animate-scale-in",
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
              className="px-3 py-1.5 text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-md transition-colors"
              data-testid={currentStep === totalSteps - 1 ? 'tour-finish-btn' : 'tour-next-btn'}
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
