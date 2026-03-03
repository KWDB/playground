import { ArrowLeft, HelpCircle, ImageIcon, Server } from 'lucide-react'
import StatusIndicator, { StatusType } from '../../../components/ui/StatusIndicator'

type Props = {
  title: string
  containerStatus: string
  isStartingContainer: boolean
  imageSourceLabel: string
  effectiveImage: string
  canPickImage: boolean
  onBack: () => void
  onOpenTour: () => void
  onOpenImageSelector: () => void
  onStart: () => void
  onResume: () => void
  onPause: () => void
  onStop: () => void
}

export const LearnTopBar = ({
  title,
  containerStatus,
  isStartingContainer,
  imageSourceLabel,
  effectiveImage,
  canPickImage,
  onBack,
  onOpenTour,
  onOpenImageSelector,
  onStart,
  onResume,
  onPause,
  onStop,
}: Props) => {
  return (
    <header className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-light)] px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="btn btn-ghost text-sm" title="返回课程列表">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">返回</span>
          </button>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h1>
            <button onClick={onOpenTour} className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors" title="查看引导" data-tour-id="learn-help-btn">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <StatusIndicator
            status={containerStatus as StatusType}
            label={`容器: ${containerStatus === 'running' ? '运行中' : containerStatus === 'starting' ? '启动中' : containerStatus === 'stopping' ? '停止中' : containerStatus === 'paused' ? '已暂停' : containerStatus === 'error' ? '错误' : '已停止'}`}
            icon={Server}
            size="sm"
          />
          <div className="flex items-center space-x-3">
            {canPickImage && (
              <button onClick={onOpenImageSelector} className="btn btn-ghost text-sm" title={`镜像源：${imageSourceLabel}（${effectiveImage}）`} data-tour-id="learn-image-source">
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">镜像源</span>
                <span className="ml-2 inline-block rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] max-w-40 truncate align-middle">{imageSourceLabel}</span>
              </button>
            )}
            {canPickImage ? (
              <button onClick={onStart} disabled={isStartingContainer} className="btn btn-primary text-sm" data-tour-id="learn-start-container">
                <span>{isStartingContainer ? '启动中...' : '启动容器'}</span>
              </button>
            ) : containerStatus === 'paused' ? (
              <div className="flex items-center space-x-2" data-tour-id="learn-pause-resume">
                <button onClick={onResume} className="btn btn-primary text-sm"><span>恢复容器</span></button>
                <button onClick={onStop} className="btn btn-danger text-sm"><span>停止容器</span></button>
              </div>
            ) : containerStatus === 'running' || containerStatus === 'stopping' ? (
              <div className="flex items-center space-x-2" data-tour-id="learn-pause-resume">
                <button onClick={onPause} disabled={containerStatus === 'stopping'} className="btn btn-secondary text-sm"><span>暂停容器</span></button>
                <button onClick={onStop} disabled={containerStatus === 'stopping'} className="btn btn-danger text-sm"><span>{containerStatus === 'stopping' ? '停止中...' : '停止容器'}</span></button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
