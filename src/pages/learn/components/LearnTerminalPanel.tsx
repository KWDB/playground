import React from 'react'
import { Lightbulb } from 'lucide-react'
import TerminalComponent, { TerminalRef, ContainerStatus as TerminalContainerStatus } from '../../../components/business/Terminal'
import SqlTerminal, { SqlTerminalRef } from '../../../components/business/SqlTerminal'
import CodeTerminal, { CodeTerminalRef } from '../../../components/business/CodeTerminal'
import { Course } from '../../../store/learnStore'
import { LEARN_START_TIPS } from '../tips'

type Props = {
  course: Course
  containerId: string | null
  containerStatus: TerminalContainerStatus
  isStartingContainer: boolean
  startTip?: string | null
  terminalRef: React.RefObject<TerminalRef>
  sqlTerminalRef: React.RefObject<SqlTerminalRef>
  codeTerminalRef: React.RefObject<CodeTerminalRef>
  onImagePullComplete: () => void
  onCancelImagePull: () => void
}

export const LearnTerminalPanel = ({
  course,
  containerId,
  containerStatus,
  isStartingContainer,
  startTip,
  terminalRef,
  sqlTerminalRef,
  codeTerminalRef,
  onImagePullComplete,
  onCancelImagePull,
}: Props) => {
  const showDisconnectedState = containerStatus !== 'running' && containerStatus !== 'starting' && !isStartingContainer

  return (
    <div className="h-full text-[var(--color-text-primary)] flex flex-col bg-[var(--color-bg-secondary)]" data-tour-id="learn-terminal">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto terminal-scrollbar">
            {!course?.sqlTerminal && !course?.codeTerminal && (
              <div className="h-full">
                {(containerStatus === 'running' || containerStatus === 'starting' || isStartingContainer) ? (
                  <TerminalComponent ref={terminalRef} containerId={containerId} containerStatus={containerStatus} tips={LEARN_START_TIPS} onCancelImagePull={onCancelImagePull} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg-secondary)] p-6">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-2">终端未连接</p>
                    <p className="text-[var(--color-text-tertiary)] text-xs">启动容器后即可使用 Shell 终端</p>
                    {showDisconnectedState && startTip && <LearnStartTip tip={startTip} />}
                  </div>
                )}
              </div>
            )}
            {course?.sqlTerminal && course?.backend?.port && course?.id && (
              <SqlTerminal ref={sqlTerminalRef} courseId={course.id} port={course.backend.port} containerStatus={containerStatus} onImagePullComplete={onImagePullComplete} onCancelImagePull={onCancelImagePull} tips={LEARN_START_TIPS} />
            )}
            {course?.codeTerminal && (
              <CodeTerminal ref={codeTerminalRef} courseId={course.id} containerId={containerId} containerStatus={containerStatus} onImagePullComplete={onImagePullComplete} onCancelImagePull={onCancelImagePull} tips={LEARN_START_TIPS} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const LearnStartTip = ({ tip }: { tip: string }) => (
  <div className="mt-4 w-full max-w-md">
    <div
      className="flex items-start gap-2 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
      role="status"
      aria-live="polite"
      data-testid="learn-start-tip"
    >
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
      <div className="min-w-0 leading-5">
        <span className="font-medium text-[var(--color-text-primary)]">小提示：</span>
        <span>{tip}</span>
      </div>
    </div>
  </div>
)
