import { WAIT_RETRY_INTERVAL_MS, WAIT_RETRY_MAX } from '../constants'
import { ContainerStatusResponse } from '../../../lib/api/types'

type WaitForContainerReadyParams = {
  containerId: string
  checkContainerStatus: (id: string, shouldUpdateState: boolean, signal?: AbortSignal) => Promise<ContainerStatusResponse | null>
  setContainerStatus: (status: ContainerStatusResponse['status']) => void
  startStatusMonitoring: (id: string) => void
  connectToTerminal: (id: string) => void
  lastActionRef: React.MutableRefObject<'idle' | 'start' | 'stop'>
  isStoppingRef: React.MutableRefObject<boolean>
  signal?: AbortSignal
  maxRetries?: number
  retryInterval?: number
}

export const isPortConflictError = (message: string) => {
  const lower = message.toLowerCase()
  return lower.includes('port') && (
    lower.includes('already') ||
    lower.includes('in use') ||
    lower.includes('bind') ||
    lower.includes('occupied')
  )
}

export const waitForContainerReady = async ({
  containerId,
  checkContainerStatus,
  setContainerStatus,
  startStatusMonitoring,
  connectToTerminal,
  lastActionRef,
  isStoppingRef,
  signal,
  maxRetries = WAIT_RETRY_MAX,
  retryInterval = WAIT_RETRY_INTERVAL_MS,
}: WaitForContainerReadyParams) => {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, retryInterval))
    }

    const statusData = await checkContainerStatus(containerId, true, signal)

    if (statusData && statusData.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const finalCheck = await checkContainerStatus(containerId, false, signal)

      if (finalCheck && finalCheck.status === 'running') {
        if (lastActionRef.current === 'stop' || isStoppingRef.current) {
          return false
        }
        setContainerStatus('running')
        startStatusMonitoring(containerId)
        setTimeout(() => {
          if (lastActionRef.current !== 'stop' && !isStoppingRef.current) {
            connectToTerminal(containerId)
          }
        }, 500)
        return true
      }
      continue
    }

    if (statusData && statusData.status === 'starting') {
      continue
    }

    if (statusData && (statusData.status === 'exited' || statusData.status === 'error')) {
      if (statusData.status === 'exited' && statusData.exitCode === 0) {
        setContainerStatus('completed')
        return true
      }
      throw new Error(`容器启动失败，状态: ${statusData.status}${statusData.exitCode ? `, 退出码: ${statusData.exitCode}` : ''}`)
    }
  }

  throw new Error('容器启动超时，可能原因：镜像拉取完成后容器创建/启动失败，或 Docker 资源不足。请检查 Docker 状态后重试。')
}
