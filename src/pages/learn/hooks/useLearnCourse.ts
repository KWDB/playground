import { useCallback, useEffect, useLayoutEffect } from 'react'
import { api } from '../../../lib/api/client'
import { useLearnStore } from '../../../store/learnStore'

type Params = {
  courseId: string | undefined
  checkExistingContainer: (courseId: string, signal?: AbortSignal) => Promise<void>
}

export const useLearnCourse = ({ courseId, checkExistingContainer }: Params) => {
  const {
    setCourse,
    setLoading,
    setError,
    loadProgress,
    resetState,
  } = useLearnStore()

  const fetchCourse = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const data = await api.courses.get(id, signal)
      setCourse(data.course)
    } catch (err) {
      const maybeAbortError = err as { name?: string }
      if (maybeAbortError?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [setCourse, setError, setLoading])

  useLayoutEffect(() => {
    if (courseId) {
      resetState()
    }
  }, [courseId, resetState])

  useEffect(() => {
    if (!courseId) return
    const controller = new AbortController()
    const initCourse = async () => {
      await fetchCourse(courseId, controller.signal)
      checkExistingContainer(courseId, controller.signal)
      loadProgress(courseId)
    }
    initCourse()
    return () => controller.abort()
  }, [courseId, fetchCourse, checkExistingContainer, loadProgress])
}
