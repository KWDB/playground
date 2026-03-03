import { useEffect } from 'react'
import { useLearnStore } from '../../../store/learnStore'
import { useContainerRefs } from './useContainerRefs'
import { useContainerMonitoring } from './useContainerMonitoring'
import { useContainerActions } from './useContainerActions'
import { useContainerInit } from './useContainerInit'

export const useLearnContainer = (courseId: string | undefined) => {
  const {
    containerId,
    containerStatus,
    isStartingContainer,
    selectedImage,
    setContainerId,
    setContainerStatus,
    setIsStartingContainer,
    setError,
    setShowPortConflictHandler,
    setIsConnected,
    setConnectionError,
  } = useLearnStore()

  const refs = useContainerRefs(courseId, containerId, containerStatus)

  const { checkContainerStatus, startStatusMonitoring, stopStatusMonitoring } = useContainerMonitoring({
    containerStatus,
    setContainerStatus,
    setIsConnected,
    setConnectionError,
    containerStatusRef: refs.containerStatusRef,
    statusCheckIntervalRef: refs.statusCheckIntervalRef,
    statusAbortControllerRef: refs.statusAbortControllerRef,
    lastActionRef: refs.lastActionRef,
    isStoppingRef: refs.isStoppingRef,
  })

  const actions = useContainerActions({
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
    startAbortControllerRef: refs.startAbortControllerRef,
    lastActionRef: refs.lastActionRef,
    isStoppingRef: refs.isStoppingRef,
    checkContainerStatus,
    startStatusMonitoring,
    stopStatusMonitoring,
  })

  const init = useContainerInit({
    containerId,
    setContainerId,
    setContainerStatus,
    setIsStartingContainer,
    setIsConnected,
    setConnectionError,
    checkContainerStatus,
    startStatusMonitoring,
    lastActionRef: refs.lastActionRef,
    isStoppingRef: refs.isStoppingRef,
  })

  useEffect(() => {
    return () => {
      stopStatusMonitoring()
      if (refs.startAbortControllerRef.current) {
        refs.startAbortControllerRef.current.abort()
        refs.startAbortControllerRef.current = null
      }
      setContainerId(null)
    }
  }, [refs.startAbortControllerRef, setContainerId, stopStatusMonitoring])

  return {
    containerId,
    containerStatus,
    isStartingContainer,
    ...actions,
    ...init,
  }
}
