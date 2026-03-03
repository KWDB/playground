import { useCallback } from 'react'
import { api } from '../../../lib/api/client'
import { ContainerStatusResponse } from '../../../lib/api/types'
import { isPortConflictError, waitForContainerReady } from '../utils/container'

type Params = {
  selectedImage: string
  containerId: string | null
  containerStatus: string
  setContainerId: (id: string | null) => void
  setContainerStatus: (status: string) => void
  setIsStartingContainer: (isStarting: boolean) => void
  setError: (error: string | null) => void
  setShowPortConflictHandler: (show: boolean) => void
  setIsConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  startAbortControllerRef: React.MutableRefObject<AbortController | null>
  lastActionRef: React.MutableRefObject<'idle' | 'start' | 'stop'>
  isStoppingRef: React.MutableRefObject<boolean>
  checkContainerStatus: (id: string, shouldUpdateState?: boolean, signal?: AbortSignal) => Promise<ContainerStatusResponse | null>
  startStatusMonitoring: (id: string) => void
  stopStatusMonitoring: () => void
}

export const useContainerActions = ({
  selectedImage,
  containerId,
  containerStatus,
  setContainerId,
  setContainerStatus,
  setIsStartingContainer,
  setError,
  setShowPortConflictHandler,
  setIsConnected,
  setConnectionError,
  startAbortControllerRef,
  lastActionRef,
  isStoppingRef,
  checkContainerStatus,
  startStatusMonitoring,
  stopStatusMonitoring,
}: Params) => {
  const connectToTerminal = useCallback((id: string) => {
    if (!id) {
      setConnectionError('容器ID为空')
      return
    }
    if (containerStatus !== 'running') {
      setConnectionError('容器未运行')
      return
    }
    setIsConnected(true)
    setConnectionError(null)
  }, [containerStatus, setConnectionError, setIsConnected])

  const startCourseContainer = useCallback(async (id: string) => {
    if (containerStatus === 'running' || containerStatus === 'starting') {
      return
    }
    lastActionRef.current = 'start'
    isStoppingRef.current = false

    setIsStartingContainer(true)
    setContainerStatus('starting')
    setError(null)
    setConnectionError(null)

    try {
      startAbortControllerRef.current?.abort()
      const controller = new AbortController()
      startAbortControllerRef.current = controller
      const requestBody = selectedImage ? { image: selectedImage } : {}
      const data = await api.courses.start(
        id,
        Object.keys(requestBody).length > 0 ? requestBody : undefined,
        controller.signal
      )

      setContainerId(data.containerId)
      await waitForContainerReady({
        containerId: data.containerId,
        checkContainerStatus,
        setContainerStatus,
        startStatusMonitoring,
        connectToTerminal,
        lastActionRef,
        isStoppingRef,
        signal: startAbortControllerRef.current?.signal,
      })
    } catch (error) {
      const maybeAbort = error as { name?: string }
      if (maybeAbort?.name === 'AbortError') {
        return
      }
      const errorMessage = error instanceof Error ? error.message : '启动容器失败'
      if (isPortConflictError(errorMessage)) {
        setShowPortConflictHandler(true)
        setContainerStatus('error')
      } else {
        setError(errorMessage)
        setContainerStatus('error')
        setConnectionError('容器启动失败，无法建立连接')
      }
    } finally {
      setIsStartingContainer(false)
    }
  }, [checkContainerStatus, connectToTerminal, containerStatus, isStoppingRef, lastActionRef, selectedImage, setConnectionError, setContainerId, setContainerStatus, setError, setIsStartingContainer, setShowPortConflictHandler, startAbortControllerRef, startStatusMonitoring])

  const stopContainer = useCallback(async (id: string) => {
    try {
      lastActionRef.current = 'stop'
      isStoppingRef.current = true
      setIsStartingContainer(false)
      setContainerStatus('stopping')
      stopStatusMonitoring()

      if (containerId) {
        try {
          await api.containers.stop(containerId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : ''
          if (!msg.includes('404')) {
            throw err
          }
        }
      } else {
        try {
          await api.courses.stop(id)
        } catch (err) {
          const msg = err instanceof Error ? err.message : ''
          if (!msg.includes('404')) {
            throw err
          }
        }
      }

      setContainerStatus('stopped')
      setIsConnected(false)
      setConnectionError(null)
      setContainerId(null)
      isStoppingRef.current = false
      stopStatusMonitoring()
      if (startAbortControllerRef.current) {
        startAbortControllerRef.current.abort()
        startAbortControllerRef.current = null
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '停止容器失败')
      setContainerStatus('error')
      isStoppingRef.current = false
    }
  }, [containerId, isStoppingRef, lastActionRef, setConnectionError, setContainerId, setContainerStatus, setError, setIsConnected, setIsStartingContainer, startAbortControllerRef, stopStatusMonitoring])

  const pauseContainer = useCallback(async (id: string) => {
    try {
      if (containerId) {
        await api.containers.pause(containerId)
      } else {
        await api.courses.pause(id)
      }
      setContainerStatus('paused')
      stopStatusMonitoring()
    } catch (error) {
      setError(error instanceof Error ? error.message : '暂停容器失败')
      setContainerStatus('error')
    }
  }, [containerId, setContainerStatus, setError, stopStatusMonitoring])

  const resumeContainer = useCallback(async (id: string) => {
    try {
      if (containerId) {
        await api.containers.resume(containerId)
      } else {
        await api.courses.resume(id)
      }
      setContainerStatus('running')
      if (containerId) {
        setTimeout(() => {
          connectToTerminal(containerId)
        }, 500)
        startStatusMonitoring(containerId)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '恢复容器失败')
      setContainerStatus('error')
    }
  }, [containerId, connectToTerminal, setContainerStatus, setError, startStatusMonitoring])

  return {
    startCourseContainer,
    stopContainer,
    pauseContainer,
    resumeContainer,
    connectToTerminal,
  }
}
