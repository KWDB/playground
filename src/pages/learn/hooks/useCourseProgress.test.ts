import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCourseProgress } from './useCourseProgress'

const course = {
  id: 'c1',
  title: 't',
  description: 'd',
  details: {
    intro: { content: 'intro-content' },
    steps: [
      { title: 's1', content: 'c1' },
      { title: 's2', content: 'c2' },
    ],
    finish: { content: 'finish-content' },
  },
}

describe('useCourseProgress', () => {
  it('returns intro title and content at -1', () => {
    const setCurrentStep = vi.fn()
    const { result } = renderHook(() => useCourseProgress({ course, currentStep: -1, setCurrentStep }))
    expect(result.current.currentTitle).toBe('课程介绍')
    expect(result.current.currentContent).toBe('intro-content')
    expect(result.current.canGoPrevious()).toBe(false)
  })

  it('moves to previous and next step', () => {
    const setCurrentStep = vi.fn()
    const { result } = renderHook(() => useCourseProgress({ course, currentStep: 1, setCurrentStep }))
    act(() => {
      result.current.goToPrevious()
      result.current.goToNext()
    })
    expect(setCurrentStep).toHaveBeenCalledWith(0)
    expect(setCurrentStep).toHaveBeenCalledWith(2)
  })
})
