import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api/client'
import { useLearnStore } from '../../../store/learnStore'

type Params = {
  stopContainer: (courseId: string) => Promise<void>
}

export const useLearnActions = ({ stopContainer }: Params) => {
  const navigate = useNavigate()
  const {
    course,
    containerStatus,
    setShowConfirmDialog,
    setShowResetDialog,
    setCurrentStep,
  } = useLearnStore()

  const exitCourse = useCallback(async () => {
    if (containerStatus === 'paused') {
      return
    }
    if (containerStatus === 'running' && course?.id) {
      await stopContainer(course.id)
    }
  }, [containerStatus, course?.id, stopContainer])

  const handleBackClick = useCallback(() => {
    navigate('/courses')
  }, [navigate])

  const handleExitClick = useCallback(() => {
    setShowConfirmDialog(true)
  }, [setShowConfirmDialog])

  const handleConfirmExit = useCallback(() => {
    setShowConfirmDialog(false)
    navigate('/courses')
    setTimeout(async () => {
      try {
        await exitCourse()
      } catch {
        return
      }
    }, 100)
  }, [exitCourse, navigate, setShowConfirmDialog])

  const handleCancelExit = useCallback(() => {
    setShowConfirmDialog(false)
  }, [setShowConfirmDialog])

  const handleResetProgress = useCallback(() => {
    if (!course?.id) return
    setShowResetDialog(true)
  }, [course?.id, setShowResetDialog])

  const handleConfirmReset = useCallback(async () => {
    if (!course?.id) return
    setShowResetDialog(false)
    try {
      await api.courses.resetProgress(course.id)
      setCurrentStep(-1)
    } catch {
      alert('重置进度失败，请重试')
    }
  }, [course?.id, setCurrentStep, setShowResetDialog])

  return {
    handleBackClick,
    handleExitClick,
    handleConfirmExit,
    handleCancelExit,
    handleResetProgress,
    handleConfirmReset,
  }
}
