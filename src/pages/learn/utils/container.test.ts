import { describe, expect, it, vi } from 'vitest'
import { isPortConflictError, waitForContainerReady } from './container'

describe('learn container utils', () => {
  it('detects port conflict keywords', () => {
    expect(isPortConflictError('port bind: address already in use')).toBe(true)
    expect(isPortConflictError('container failed')).toBe(false)
  })

  it('waits container until running and returns true', async () => {
    const statuses = [{ status: 'starting' }, { status: 'running' }, { status: 'running' }]
    const check = vi.fn().mockImplementation(async () => statuses.shift() || { status: 'running' })
    const setContainerStatus = vi.fn()
    const startStatusMonitoring = vi.fn()
    const connectToTerminal = vi.fn()

    const result = await waitForContainerReady({
      containerId: 'c-1',
      checkContainerStatus: check,
      setContainerStatus,
      startStatusMonitoring,
      connectToTerminal,
      lastActionRef: { current: 'start' },
      isStoppingRef: { current: false },
      maxRetries: 3,
      retryInterval: 1,
    })

    expect(result).toBe(true)
    expect(setContainerStatus).toHaveBeenCalledWith('running')
    expect(startStatusMonitoring).toHaveBeenCalledWith('c-1')
  })

  it('returns completed for exited with code 0', async () => {
    const check = vi.fn().mockResolvedValue({ status: 'exited', exitCode: 0 })
    const setContainerStatus = vi.fn()

    const result = await waitForContainerReady({
      containerId: 'c-1',
      checkContainerStatus: check,
      setContainerStatus,
      startStatusMonitoring: vi.fn(),
      connectToTerminal: vi.fn(),
      lastActionRef: { current: 'start' },
      isStoppingRef: { current: false },
      maxRetries: 1,
      retryInterval: 1,
    })

    expect(result).toBe(true)
    expect(setContainerStatus).toHaveBeenCalledWith('completed')
  })

  it('throws timeout when never ready', async () => {
    const check = vi.fn().mockResolvedValue({ status: 'starting' })
    await expect(waitForContainerReady({
      containerId: 'c-1',
      checkContainerStatus: check,
      setContainerStatus: vi.fn(),
      startStatusMonitoring: vi.fn(),
      connectToTerminal: vi.fn(),
      lastActionRef: { current: 'start' },
      isStoppingRef: { current: false },
      maxRetries: 1,
      retryInterval: 1,
    })).rejects.toThrow('容器启动超时')
  })
})
