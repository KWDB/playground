import { useEffect, useRef } from 'react'

export const useContainerRefs = (
  courseId: string | undefined,
  containerId: string | null,
  containerStatus: string,
) => {
  const courseIdRef = useRef(courseId)
  const containerStatusRef = useRef(containerStatus)
  const containerIdRef = useRef(containerId)
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusAbortControllerRef = useRef<AbortController | null>(null)
  const startAbortControllerRef = useRef<AbortController | null>(null)
  const lastActionRef = useRef<'idle' | 'start' | 'stop'>('idle')
  const isStoppingRef = useRef(false)

  useEffect(() => {
    courseIdRef.current = courseId
  }, [courseId])

  useEffect(() => {
    containerStatusRef.current = containerStatus
  }, [containerStatus])

  useEffect(() => {
    containerIdRef.current = containerId
  }, [containerId])

  return {
    courseIdRef,
    containerStatusRef,
    containerIdRef,
    statusCheckIntervalRef,
    statusAbortControllerRef,
    startAbortControllerRef,
    lastActionRef,
    isStoppingRef,
  }
}
