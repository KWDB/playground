import React, { useRef, useEffect } from 'react';

export interface CourseContentPanelProps {
  title: string;
  content: string;
  renderMarkdown: (content: string) => React.ReactNode;
  currentStep: number;
  stepsLength: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onExit: () => void;
}

export default function CourseContentPanel({
  title,
  content,
  renderMarkdown,
  currentStep,
  stepsLength,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onExit,
}: CourseContentPanelProps) {
  const isCompleted = currentStep >= stepsLength;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const steps = [];
  for (let i = -1; i <= stepsLength; i++) {
    steps.push({
      id: i,
      title: i === -1 ? '介绍' : i === stepsLength ? '完成' : `步骤 ${i + 1}`
    });
  }

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  return (
    <div className="h-full bg-[var(--color-bg-primary)] border-r border-[var(--color-border-light)] flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-4 bg-[var(--color-bg-primary)] border-b border-[var(--color-border-light)]">
        <h2 className="text-base font-medium text-[var(--color-text-primary)] text-balance">{title}</h2>
      </div>
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto markdown-scroll-container">
        <div className="markdown-main-content">
          <div className="markdown-content-wrapper">
            <div className="markdown-prose">
              {renderMarkdown(content)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-[var(--color-border-light)]">
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-primary)]"></div>
            <span className="font-medium">{currentStep + 2} / {steps.length}</span>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((step) => {
              const isStepCompleted = currentStep > step.id;
              const isStepCurrent = currentStep === step.id;
              const isClickable = step.id <= currentStep || step.id === currentStep + 1;
              return (
                <button
                  key={step.id}
                  onClick={() => isClickable && (step.id === -1 ? onPrev() : step.id === stepsLength ? onExit() : (step.id < currentStep ? onPrev() : onNext()))}
                  disabled={!isClickable}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isStepCompleted ? 'bg-[var(--color-accent-primary)]' :
                    isStepCurrent ? 'bg-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-subtle)]' :
                    isClickable ? 'bg-[var(--color-border-default)] hover:bg-[var(--color-border-dark)]' :
                    'bg-[var(--color-border-light)] cursor-not-allowed'
                  }`}
                  title={step.title}
                />
              );
            })}
          </div>
          <span className="text-sm text-[var(--color-text-secondary)] truncate max-w-[120px]">{steps.find(s => s.id === currentStep)?.title || '介绍'}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-primary)]">
          {isCompleted ? (
            <>
              <button onClick={onPrev} disabled={!canPrev} className="btn btn-secondary text-sm">上一步</button>
              <span className="text-sm text-[var(--color-text-secondary)]">完成</span>
              <button onClick={onExit} className="btn btn-ghost text-sm text-[var(--color-error)]">退出课程</button>
            </>
          ) : (
            <>
              <button onClick={onPrev} disabled={!canPrev} className="btn btn-secondary text-sm">上一步</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{currentStep === -1 ? '介绍' : `步骤 ${currentStep + 1}/${stepsLength}`}</span>
              <button onClick={onNext} disabled={!canNext} className="btn btn-primary text-sm">下一步</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
