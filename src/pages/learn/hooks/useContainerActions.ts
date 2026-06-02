import { useCallback } from 'react'
import { api } from '../../../lib/api/client'
import { ContainerStatusResponse } from '../../../lib/api/types'
import { isPortConflictError, waitForContainerReady } from '../utils/container'

const isNotFoundError = (error: unknown) => {
  const maybeError = error as { statusCode?: number; message?: string }
  if (maybeError?.statusCode === 404) {
    return true
  }
  const message = maybeError?.message ?? ''
  return message.includes('404') || message.toLowerCase().includes('not found')
}

const isStartInProgressError = (error: unknown) => {
  const maybeError = error as { statusCode?: number; message?: string }
  if (maybeError?.statusCode === 409) {
    return true
  }
  const message = maybeError?.message ?? ''
  return message.includes('课程容器正在启动中')
}

const isRequestCanceledError = (error: unknown) => {
  const maybeError = error as { name?: string; message?: string }
  return maybeError?.name === 'AbortError' || maybeError?.message === '请求已取消'
}

type Params = {
  selectedImage: string
  containerId: string | null
  containerStatus: string
  containerStatusRef: React.MutableRefObject<string>
  setContainerId: (id: string | null) => void
  setContainerStatus: (status: string) => void
  setIsStartingContainer: (isStarting: boolean) => void
  setError: (error: string | null) => void
  setShowPortConflictHandler: (show: boolean) => void
  setIsConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  startAbortControllerRef: React.MutableRefObject<AbortController | null>
  startOperationSeqRef: React.MutableRefObject<number>
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
  containerStatusRef,
  setContainerId,
  setContainerStatus,
  setIsStartingContainer,
  setError,
  setShowPortConflictHandler,
  setIsConnected,
  setConnectionError,
  startAbortControllerRef,
  startOperationSeqRef,
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
    if (containerStatusRef.current !== 'running') {
      setConnectionError('容器未运行')
      return
    }
    setIsConnected(true)
    setConnectionError(null)
  }, [containerStatusRef, setConnectionError, setIsConnected])

  const isStartCancelRequested = useCallback(() => {
    return lastActionRef.current === 'stop' || isStoppingRef.current
  }, [isStoppingRef, lastActionRef])

  const isCurrentStartOperation = useCallback((operationSeq: number, controller: AbortController) => {
    return startOperationSeqRef.current === operationSeq && startAbortControllerRef.current === controller
  }, [startAbortControllerRef, startOperationSeqRef])

  const startCourseContainer = useCallback(async (id: string, hostPort?: number) => {
    if (containerStatus === 'running' || containerStatus === 'starting') {
      return
    }
    const operationSeq = startOperationSeqRef.current + 1
    startOperationSeqRef.current = operationSeq
    lastActionRef.current = 'start'
    isStoppingRef.current = false

    setIsStartingContainer(true)
    setContainerStatus('starting')
    setError(null)
    setConnectionError(null)
    let controller: AbortController | null = null

    try {
      startAbortControllerRef.current?.abort()
      controller = new AbortController()
      startAbortControllerRef.current = controller
      const requestBody: { image?: string; hostPort?: number } = {}
      if (selectedImage) {
        requestBody.image = selectedImage
      }
      if (typeof hostPort === 'number' && Number.isInteger(hostPort) && hostPort > 0) {
        requestBody.hostPort = hostPort
      }
      const data = await api.courses.start(
        id,
        Object.keys(requestBody).length > 0 ? requestBody : undefined,
        controller.signal
      )

      if (!isCurrentStartOperation(operationSeq, controller)) {
        await api.containers.remove(data.containerId).catch(() => undefined)
        return
      }

      if (controller.signal.aborted || isStartCancelRequested()) {
        await api.containers.remove(data.containerId).catch(() => undefined)
        setContainerId(null)
        setContainerStatus('stopped')
        setConnectionError(null)
        return
      }

      setContainerId(data.containerId)
      const isReady = await waitForContainerReady({
        containerId: data.containerId,
        checkContainerStatus,
        setContainerStatus,
        startStatusMonitoring,
        connectToTerminal,
        lastActionRef,
        isStoppingRef,
        signal: startAbortControllerRef.current?.signal,
      })
      if (!isReady && isStartCancelRequested()) {
        await api.containers.cleanup(id).catch(() => undefined)
        setContainerId(null)
        setContainerStatus('stopped')
        setConnectionError(null)
      }
    } catch (error) {
      if (!controller || !isCurrentStartOperation(operationSeq, controller)) {
        return
      }
      if (isRequestCanceledError(error) || isStartCancelRequested()) {
        setContainerStatus('stopped')
        setConnectionError(null)
        return
      }
      if (isStartInProgressError(error)) {
        setContainerStatus('starting')
        setError(null)
        setConnectionError(null)
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
      if (controller && isCurrentStartOperation(operationSeq, controller)) {
        setIsStartingContainer(false)
      }
    }
  }, [checkContainerStatus, connectToTerminal, containerStatus, isCurrentStartOperation, isStartCancelRequested, isStoppingRef, lastActionRef, selectedImage, setConnectionError, setContainerId, setContainerStatus, setError, setIsStartingContainer, setShowPortConflictHandler, startAbortControllerRef, startOperationSeqRef, startStatusMonitoring])

  const stopContainer = useCallback(async (id: string) => {
    try {
      lastActionRef.current = 'stop'
      isStoppingRef.current = true
      setIsStartingContainer(false)
      setContainerStatus('stopping')
      stopStatusMonitoring()
      if (startAbortControllerRef.current) {
        startAbortControllerRef.current.abort()
        startAbortControllerRef.current = null
      }

      if (containerId) {
        try {
          await api.containers.stop(containerId)
        } catch (err) {
          if (!isNotFoundError(err)) {
            throw err
          }
          await api.courses.stop(id)
        }
      } else {
        try {
          await api.courses.stop(id)
        } catch (err) {
          if (!isNotFoundError(err)) {
            throw err
          }
        }
      }

      await api.containers.cleanup(id)

      setContainerStatus('stopped')
      setIsConnected(false)
      setConnectionError(null)
      setContainerId(null)
    } catch (error) {
      try {
        await api.containers.cleanup(id)
        setContainerStatus('stopped')
        setIsConnected(false)
        setConnectionError(null)
        setContainerId(null)
      } catch {
        setError(error instanceof Error ? error.message : '停止容器失败')
        setContainerStatus('error')
      }
    } finally {
      isStoppingRef.current = false
      stopStatusMonitoring()
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

  const cancelStartContainer = useCallback(async (id: string) => {
    startOperationSeqRef.current += 1
    lastActionRef.current = 'stop'
    isStoppingRef.current = true
    setIsStartingContainer(false)
    setContainerStatus('stopped')
    setIsConnected(false)
    setConnectionError(null)
    stopStatusMonitoring()

    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort()
      startAbortControllerRef.current = null
    }

    try {
      if (containerId) {
        try {
          await api.containers.stop(containerId)
        } catch (err) {
          if (!isNotFoundError(err)) {
            throw err
          }
        }
      }
      await api.containers.cleanup(id)
    } catch (error) {
      setError(error instanceof Error ? error.message : '取消拉取镜像失败')
    } finally {
      setContainerId(null)
      setContainerStatus('stopped')
      setIsConnected(false)
      setIsStartingContainer(false)
      setConnectionError(null)
      isStoppingRef.current = false
    }
  }, [containerId, isStoppingRef, lastActionRef, setConnectionError, setContainerId, setContainerStatus, setError, setIsConnected, setIsStartingContainer, startAbortControllerRef, startOperationSeqRef, stopStatusMonitoring])

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
    cancelStartContainer,
    resumeContainer,
    connectToTerminal,
  }
}
