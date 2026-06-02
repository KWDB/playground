import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImagePullProgressOverlay from './ImagePullProgressOverlay'

const progress = {
  imageName: 'kwdb/playground:latest',
  status: 'pulling',
  progressPercent: 20,
}

describe('ImagePullProgressOverlay', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders pull tips when provided', () => {
    render(<ImagePullProgressOverlay show imagePullProgress={progress} tips={['镜像下载较慢时，可以先切换到更近的镜像源再启动课程。']} />)

    expect(screen.getByTestId('image-pull-tip')).toHaveTextContent('小提示')
    expect(screen.getByTestId('image-pull-tip')).toHaveTextContent('镜像下载较慢时，可以先切换到更近的镜像源再启动课程。')
  })

  it('rotates pull tips while the overlay is visible', () => {
    vi.useFakeTimers()
    render(<ImagePullProgressOverlay show imagePullProgress={progress} tips={['第一条提示', '第二条提示']} />)

    expect(screen.getByTestId('image-pull-tip')).toHaveTextContent('第一条提示')

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByTestId('image-pull-tip')).toHaveTextContent('第二条提示')
  })

  it('uses animated progress states', () => {
    const { rerender, container } = render(<ImagePullProgressOverlay show imagePullProgress={{ ...progress, progressPercent: undefined }} />)

    expect(container.querySelector('.image-pull-progress-indeterminate')).toBeInTheDocument()

    rerender(<ImagePullProgressOverlay show imagePullProgress={progress} />)

    expect(container.querySelector('.image-pull-progress-fill')).toBeInTheDocument()
  })

  it('keeps the same overlay node when progress updates', () => {
    const { rerender, container } = render(<ImagePullProgressOverlay show imagePullProgress={progress} />)
    const overlay = container.querySelector('.image-pull-overlay')

    rerender(<ImagePullProgressOverlay show imagePullProgress={{ ...progress, progressPercent: 45, status: 'extracting' }} />)

    expect(container.querySelector('.image-pull-overlay')).toBe(overlay)
    expect(screen.getByText('extracting')).toBeInTheDocument()
  })

  it('calls cancel handler from the close button', () => {
    const onCancel = vi.fn()
    render(<ImagePullProgressOverlay show imagePullProgress={progress} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: '取消镜像拉取' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
