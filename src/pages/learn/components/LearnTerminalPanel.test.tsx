import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type React from 'react'
import type { CodeTerminalRef } from '../../../components/business/CodeTerminal'
import type { SqlTerminalRef } from '../../../components/business/SqlTerminal'
import type { ContainerStatus, TerminalRef } from '../../../components/business/Terminal'
import { Course } from '../../../store/learnStore'
import { LearnTerminalPanel } from './LearnTerminalPanel'

vi.mock('../../../components/business/Terminal', () => ({
  default: () => <div data-testid="shell-terminal" />,
}))

vi.mock('../../../components/business/SqlTerminal', () => ({
  default: () => <div data-testid="sql-terminal" />,
}))

vi.mock('../../../components/business/CodeTerminal', () => ({
  default: () => <div data-testid="code-terminal" />,
}))

const shellCourse: Course = {
  id: 'quick-start',
  title: '快速开始',
  description: '快速开始课程',
  details: {
    intro: { content: '' },
    steps: [],
    finish: { content: '' },
  },
}

type LearnTerminalPanelTestProps = {
  course: Course
  containerId: string | null
  containerStatus: ContainerStatus
  isStartingContainer: boolean
  startTip?: string | null
  terminalRef: React.RefObject<TerminalRef>
  sqlTerminalRef: React.RefObject<SqlTerminalRef>
  codeTerminalRef: React.RefObject<CodeTerminalRef>
  onImagePullComplete: () => void
  onCancelImagePull: () => void
}

const defaultProps: LearnTerminalPanelTestProps = {
  course: shellCourse,
  containerId: null,
  containerStatus: 'stopped',
  isStartingContainer: false,
  terminalRef: { current: null },
  sqlTerminalRef: { current: null },
  codeTerminalRef: { current: null },
  onImagePullComplete: vi.fn(),
  onCancelImagePull: vi.fn(),
}

const renderTerminalPanel = (props?: Partial<LearnTerminalPanelTestProps>) => {
  return render(<LearnTerminalPanel {...defaultProps} {...props} />)
}

describe('LearnTerminalPanel', () => {
  it('renders start tip below disconnected shell terminal copy before startup', () => {
    renderTerminalPanel({ startTip: '启动前可以切换镜像源。' })

    expect(screen.getByText('终端未连接')).toBeInTheDocument()
    expect(screen.getByText('启动容器后即可使用 Shell 终端')).toBeInTheDocument()
    expect(screen.getByTestId('learn-start-tip')).toHaveTextContent('小提示')
    expect(screen.getByTestId('learn-start-tip')).toHaveTextContent('启动前可以切换镜像源。')
  })

  it('hides start tip while the container is starting', () => {
    renderTerminalPanel({
      containerStatus: 'starting',
      isStartingContainer: true,
      startTip: '启动前可以切换镜像源。',
    })

    expect(screen.queryByTestId('learn-start-tip')).not.toBeInTheDocument()
  })

  it('hides start tip after the terminal is running', () => {
    renderTerminalPanel({
      containerId: 'container-1',
      containerStatus: 'running',
      startTip: '启动前可以切换镜像源。',
    })

    expect(screen.queryByTestId('learn-start-tip')).not.toBeInTheDocument()
    expect(screen.getByTestId('shell-terminal')).toBeInTheDocument()
  })
})
