import React, { useRef, useEffect } from 'react';

export interface CourseContentPanelProps {
  renderProgressBar: () => React.ReactNode;
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
  renderProgressBar,
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

  // 监听 currentStep 变化，自动滚动到顶部
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* 课程进度条 - 合并到内容区域 */}
      {renderProgressBar()}

      {/* 内容标题 */}
      <div className="flex-shrink-0 p-3 lg:p-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg lg:text-xl font-semibold text-gray-800">
          {title}
        </h2>
      </div>

      {/* 内容区域 - 可滚动区域 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto markdown-scroll-container"
      >
        <div className="markdown-main-content">
          <div className="markdown-content-wrapper">
            <div className="markdown-prose">
              {renderMarkdown(content)}
            </div>
          </div>
        </div>
      </div>

      {/* 导航按钮 - 固定在底部 */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 flex justify-between bg-white">
        {isCompleted ? (
          // 课程完成页面显示退出按钮
          <>
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-none"
            >
              上一步
            </button>
            <div className="flex items-center text-gray-600 text-sm font-medium">
              完成
            </div>
            <button
              onClick={onExit}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-none"
            >
              <span>退出课程</span>
            </button>
          </>
        ) : (
          // 正常导航按钮
          <>
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-none"
            >
              上一步
            </button>
            <div className="flex items-center text-gray-600 text-sm font-medium">
              {currentStep === -1 ? '介绍' : `步骤 ${currentStep + 1}/${stepsLength}`}
            </div>
            <button
              onClick={onNext}
              disabled={!canNext}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-none"
            >
              下一步
            </button>
          </>
        )}
      </div>
    </div>
  );
}