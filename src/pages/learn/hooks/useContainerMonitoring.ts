import { useCallback, useEffect } from 'react'
import { api } from '../../../lib/api/client'
import { STATUS_CHECK_INTERVAL_MS } from '../constants'

type Params = {
  containerStatus: string
  setContainerStatus: (status: string) => void
  setIsConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  containerStatusRef: React.MutableRefObject<string>
  statusCheckIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
  statusAbortControllerRef: React.MutableRefObject<AbortController | null>
  lastActionRef: React.MutableRefObject<'idle' | 'start' | 'stop'>
  isStoppingRef: React.MutableRefObject<boolean>
}

export const useContainerMonitoring = ({
  containerStatus,
  setContainerStatus,
  setIsConnected,
  setConnectionError,
  containerStatusRef,
  statusCheckIntervalRef,
  statusAbortControllerRef,
  lastActionRef,
  isStoppingRef,
}: Params) => {
  useEffect(() => {
    if (containerStatus === 'stopped' || containerStatus === 'exited') {
      setConnectionError(null)
    }
  }, [containerStatus, setConnectionError])

  const checkContainerStatus = useCallback(async (id: string, shouldUpdateState = true, signal?: AbortSignal) => {
    try {
      const data = await api.containers.getStatus(id, signal)
      if (shouldUpdateState) {
        const currentStatus = containerStatusRef.current
        const newStatus = data.status
        if (newStatus === 'running' && currentStatus === 'starting') {
          setContainerStatus(newStatus)
        } else if (newStatus === 'exited' && (currentStatus === 'running' || currentStatus === 'starting')) {
          setContainerStatus(newStatus)
        } else {
          setContainerStatus(newStatus)
        }
      }
      return data
    } catch {
      return null
    }
  }, [containerStatusRef, setContainerStatus])

  const startStatusMonitoring = useCallback((id: string) => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current)
    }
    statusCheckIntervalRef.current = setInterval(async () => {
      try {
        statusAbortControllerRef.current?.abort()
        const controller = new AbortController()
        statusAbortControllerRef.current = controller
        const statusData = await checkContainerStatus(id, false, controller.signal)
        if (statusData) {
          const currentStatus = containerStatusRef.current
          const actualStatus = statusData.status
          if (currentStatus !== actualStatus) {
            const inStopPhase = lastActionRef.current === 'stop' || isStoppingRef.current
            if (inStopPhase && (actualStatus === 'running' || actualStatus === 'starting')) {
              return
            }
            if (actualStatus === 'exited' && currentStatus === 'running') {
              setContainerStatus('stopped')
              setIsConnected(false)
              setConnectionError('容器已停止运行')
            } else if (actualStatus === 'running' && currentStatus === 'stopped') {
              if (lastActionRef.current === 'start') {
                setContainerStatus('running')
                setIsConnected(true)
                setConnectionError(null)
              }
            } else {
              setContainerStatus(actualStatus)
            }
          }
        }
      } catch {
        return
      }
    }, STATUS_CHECK_INTERVAL_MS)
  }, [checkContainerStatus, containerStatusRef, statusAbortControllerRef, statusCheckIntervalRef, lastActionRef, isStoppingRef, setConnectionError, setContainerStatus, setIsConnected])

  const stopStatusMonitoring = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current)
      statusCheckIntervalRef.current = null
    }
    if (statusAbortControllerRef.current) {
      statusAbortControllerRef.current.abort()
      statusAbortControllerRef.current = null
    }
  }, [statusAbortControllerRef, statusCheckIntervalRef])

  return {
    checkContainerStatus,
    startStatusMonitoring,
    stopStatusMonitoring,
  }
}
