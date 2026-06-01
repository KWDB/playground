import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LearnTopBar } from './LearnTopBar'

vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: () => undefined,
  }),
}))

const defaultProps = {
  title: '快速开始',
  containerStatus: 'stopped',
  isStartingContainer: false,
  imageSourceLabel: 'Docker Hub',
  effectiveImage: 'kwdb/playground:latest',
  canPickImage: true,
  showHostPortSelector: false,
  hostPortValue: '',
  hostPortConflictMessage: null,
  isHostPortChecking: false,
  onHostPortChange: vi.fn(),
  onBack: vi.fn(),
  onOpenTour: vi.fn(),
  onOpenImageSelector: vi.fn(),
  onStart: vi.fn(),
  onResume: vi.fn(),
  onPause: vi.fn(),
  onStop: vi.fn(),
}

const renderTopBar = (props?: Partial<typeof defaultProps & { startTip?: string | null }>) => {
  return render(<LearnTopBar {...defaultProps} {...props} />)
}

describe('LearnTopBar', () => {
  it('does not render start tip when no tip is provided', () => {
    renderTopBar()

    expect(screen.queryByTestId('learn-start-tip')).not.toBeInTheDocument()
  })

  it('renders start tip when provided', () => {
    renderTopBar({ startTip: '启动前可以切换镜像源。' })

    expect(screen.getByTestId('learn-start-tip')).toHaveTextContent('小提示')
    expect(screen.getByTestId('learn-start-tip')).toHaveTextContent('启动前可以切换镜像源。')
  })
})
