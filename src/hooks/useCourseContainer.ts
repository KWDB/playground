import React, { useEffect, useCallback } from 'react';
import { useLearnStore } from '../store/learnStore';

interface UseCourseContainerOptions {
  onStatusChange?: (status: string) => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

export function useCourseContainer(courseId: string | undefined, options: UseCourseContainerOptions = {}) {
  const {
    containerId,
    containerStatus,
    isStartingContainer,
    isConnected,
    connectionError,
    startCourseContainer,
    stopCourse,
    checkContainerStatus,
  } = useLearnStore()

  const handleStart = useCallback(async () => {
    if (!courseId) {
      options.onError?.('课程ID不存在')
      return
    }
    await startCourseContainer(courseId)
  }, [courseId, startCourseContainer, options])

  const handleStop = useCallback(async () => {
    await stopCourse(courseId || '', containerId)
  }, [courseId, containerId, stopCourse])

  const handleCheckStatus = useCallback(async () => {
    if (containerId) {
      await checkContainerStatus(containerId)
    }
  }, [containerId, checkContainerStatus])

  return {
    containerId,
    containerStatus,
    isStartingContainer,
    isConnected,
    connectionError,
    start: handleStart,
    stop: handleStop,
    checkStatus: handleCheckStatus,
  }
}
