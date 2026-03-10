import TerminalComponent, { TerminalRef, ContainerStatus as TerminalContainerStatus } from '../../../components/business/Terminal'
import SqlTerminal, { SqlTerminalRef } from '../../../components/business/SqlTerminal'
import CodeTerminal, { CodeTerminalRef } from '../../../components/business/CodeTerminal'
import { Course } from '../../../store/learnStore'
import React from 'react'

type Props = {
  course: Course
  containerId: string | null
  containerStatus: TerminalContainerStatus
  isStartingContainer: boolean
  terminalRef: React.RefObject<TerminalRef>
  sqlTerminalRef: React.RefObject<SqlTerminalRef>
  codeTerminalRef: React.RefObject<CodeTerminalRef>
  onImagePullComplete: () => void
}

export const LearnTerminalPanel = ({
  course,
  containerId,
  containerStatus,
  isStartingContainer,
  terminalRef,
  sqlTerminalRef,
  codeTerminalRef,
  onImagePullComplete,
}: Props) => {
  return (
    <div className="h-full text-[var(--color-text-primary)] flex flex-col bg-[var(--color-bg-secondary)]" data-tour-id="learn-terminal">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto terminal-scrollbar">
            {!course?.sqlTerminal && !course?.codeTerminal && (
              <div className="h-full">
                {(containerStatus === 'running' || containerStatus === 'starting' || isStartingContainer) ? (
                  <TerminalComponent ref={terminalRef} containerId={containerId} containerStatus={containerStatus} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg-secondary)] p-6">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-2">终端未连接</p>
                    <p className="text-[var(--color-text-tertiary)] text-xs">启动容器后即可使用 Shell 终端</p>
                  </div>
                )}
              </div>
            )}
            {course?.sqlTerminal && course?.backend?.port && course?.id && (
              <SqlTerminal ref={sqlTerminalRef} courseId={course.id} port={course.backend.port} containerStatus={containerStatus} onImagePullComplete={onImagePullComplete} />
            )}
            {course?.codeTerminal && (
              <CodeTerminal ref={codeTerminalRef} courseId={course.id} containerId={containerId} containerStatus={containerStatus} onImagePullComplete={onImagePullComplete} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
