import { useCallback, useMemo } from 'react'
import { Course } from '../../../store/learnStore'

type Params = {
  course: Course | null
  currentStep: number
  setCurrentStep: (step: number) => void
}

export const useCourseProgress = ({ course, currentStep, setCurrentStep }: Params) => {
  const currentTitle = useMemo(() => {
    if (currentStep === -1) return '课程介绍'
    if (currentStep >= (course?.details.steps.length ?? 0)) return '课程完成'
    return course?.details.steps[currentStep]?.title || ''
  }, [course, currentStep])

  const currentContent = useMemo(() => {
    if (currentStep === -1) return course?.details.intro.content || ''
    if (currentStep >= (course?.details.steps.length ?? 0)) return course?.details.finish.content || ''
    return course?.details.steps[currentStep]?.content || ''
  }, [course, currentStep])

  const canGoPrevious = useCallback(() => currentStep > -1, [currentStep])
  const canGoNext = useCallback(() => !!course && currentStep < course.details.steps.length, [course, currentStep])

  const goToPrevious = useCallback(() => {
    if (currentStep > -1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep, setCurrentStep])

  const goToNext = useCallback(() => {
    if (course && currentStep < course.details.steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }, [course, currentStep, setCurrentStep])

  return {
    currentTitle,
    currentContent,
    canGoPrevious,
    canGoNext,
    goToPrevious,
    goToNext,
  }
}
