import { ArrowLeft, HelpCircle, ImageIcon, Server } from 'lucide-react'
import StatusIndicator, { StatusType } from '../../../components/ui/StatusIndicator'
import ThemeToggle from '../../../components/layout/ThemeToggle'
import { useTheme } from '../../../hooks/useTheme'

type Props = {
  title: string
  containerStatus: string
  isStartingContainer: boolean
  imageSourceLabel: string
  effectiveImage: string
  canPickImage: boolean
  showHostPortSelector: boolean
  hostPortValue: string
  hostPortConflictMessage: string | null
  isHostPortChecking: boolean
  onHostPortChange: (value: string) => void
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
  showHostPortSelector,
  hostPortValue,
  hostPortConflictMessage,
  isHostPortChecking,
  onHostPortChange,
  onBack,
  onOpenTour,
  onOpenImageSelector,
  onStart,
  onResume,
  onPause,
  onStop,
}: Props) => {
  const { theme: currentTheme, toggleTheme } = useTheme()
  const hasPortConflict = Boolean(hostPortConflictMessage)

  return (
    <header className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-light)] px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
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
        <div className="flex items-center space-x-2">
          <ThemeToggle theme={currentTheme} onToggle={toggleTheme} />
          {showHostPortSelector && canPickImage && (
            <div
              className={`group flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors duration-150 focus-within:ring-2 ${
                hasPortConflict
                  ? 'bg-[rgba(239,68,68,0.15)] focus-within:ring-[var(--color-error)]'
                  : 'focus-within:ring-[var(--color-accent-primary)]'
              }`}
              data-tour-id="learn-host-port-selector"
            >
              {hasPortConflict ? <span className="text-[10px] text-[var(--color-error)]">⚠</span> : null}
              <span className={`text-[10px] ${hasPortConflict ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}>端口</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={hostPortValue}
                onChange={(e) => onHostPortChange(e.target.value)}
                className="h-6 w-[70px] rounded border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] px-1.5 text-[11px] text-[var(--color-text-primary)] outline-none transition-colors duration-150 focus:border-[var(--color-accent-primary)]"
                placeholder="3000"
              />
              {isHostPortChecking && !hasPortConflict && (
                <span className="text-[10px] text-[var(--color-text-tertiary)]">检查中…</span>
              )}
              {hostPortConflictMessage && (
                <span className="text-[10px] font-semibold text-[var(--color-error)] max-w-40 truncate" title={hostPortConflictMessage}>{hostPortConflictMessage}</span>
              )}
            </div>
          )}
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
