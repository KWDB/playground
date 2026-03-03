import { useCallback } from 'react'
import { api } from '../../../lib/api/client'
import { ContainerStatusResponse } from '../../../lib/api/types'

type Params = {
  containerId: string | null
  setContainerId: (id: string | null) => void
  setContainerStatus: (status: string) => void
  setIsStartingContainer: (isStarting: boolean) => void
  setIsConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  checkContainerStatus: (id: string, shouldUpdateState?: boolean, signal?: AbortSignal) => Promise<ContainerStatusResponse | null>
  startStatusMonitoring: (id: string) => void
  lastActionRef: React.MutableRefObject<'idle' | 'start' | 'stop'>
  isStoppingRef: React.MutableRefObject<boolean>
}

export const useContainerInit = ({
  containerId,
  setContainerId,
  setContainerStatus,
  setIsStartingContainer,
  setIsConnected,
  setConnectionError,
  checkContainerStatus,
  startStatusMonitoring,
  lastActionRef,
  isStoppingRef,
}: Params) => {
  const checkExistingContainer = useCallback(async (currentCourseId: string, signal?: AbortSignal) => {
    try {
      const containers = await api.containers.list(signal)
      let existingContainer = containers.find(c => c.courseId === currentCourseId && c.state === 'running')

      if (existingContainer) {
        setContainerId(existingContainer.id)
        setContainerStatus('running')
        setIsStartingContainer(false)
        lastActionRef.current = 'start'
        isStoppingRef.current = false
        setIsConnected(true)
        setConnectionError(null)
        startStatusMonitoring(existingContainer.id)
        return
      }

      existingContainer = containers.find(c => c.courseId === currentCourseId && c.state === 'paused')
      if (existingContainer) {
        setContainerId(existingContainer.id)
        setContainerStatus('paused')
        setIsStartingContainer(false)
      }
    } catch {
      return
    }
  }, [isStoppingRef, lastActionRef, setConnectionError, setContainerId, setContainerStatus, setIsConnected, setIsStartingContainer, startStatusMonitoring])

  const handleImagePullComplete = useCallback(async () => {
    if (containerId) {
      await checkContainerStatus(containerId, true)
    }
  }, [checkContainerStatus, containerId])

  return {
    checkExistingContainer,
    handleImagePullComplete,
  }
}
