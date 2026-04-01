import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Group, Panel, Separator } from 'react-resizable-panels'
import CourseContentPanel from '../components/business/CourseContentPanel'
import { SqlTerminalRef } from '../components/business/SqlTerminal'
import { TerminalRef } from '../components/business/Terminal'
import { CodeTerminalRef } from '../components/business/CodeTerminal'
import { getStepsForPage, getTotalSteps } from '../config/tourSteps'
import { useLearnStore, effectiveImageSelector, imageSourceLabelSelector } from '../store/learnStore'
import { useTourStore } from '../store/tourStore'
import {
  LearnDialogs,
  LearnErrorState,
  LearnLoadingState,
  LearnTerminalPanel,
  LearnTopBar,
  useCourseProgress,
  useExecCommand,
  useLearnActions,
  useLearnContainer,
  useLearnCourse,
  useLearnMarkdown,
} from './learn/index'
import { getCourseNotFoundError, getErrorInfo } from './learn/index'
import { api } from '../lib/api/client'
import '../styles/markdown.css'

export function Learn() {
  const { courseId } = useParams<{ courseId: string }>()
  const {
    course,
    currentStep,
    setCurrentStep,
    loading,
    error,
    showConfirmDialog,
    showResetDialog,
    showPortConflictHandler,
    showImageSelector,
    setShowImageSelector,
    setShowResetDialog,
    setShowPortConflictHandler,
    setSelectedImage,
    setSelectedImageSourceId,
    isLoadingProgress,
  } = useLearnStore()
  const { seenPages, startTour, nextStep, prevStep, skipTour, currentStep: tourCurrentStep, isActive: isTourActive, hasHydrated } = useTourStore()
  const [hostPortValue, setHostPortValue] = useState('')
  const [hostPortConflictMessage, setHostPortConflictMessage] = useState<string | null>(null)
  const [isHostPortChecking, setIsHostPortChecking] = useState(false)

  const sqlTerminalRef = useRef<SqlTerminalRef>(null)
  const terminalRef = useRef<TerminalRef>(null)
  const codeTerminalRef = useRef<CodeTerminalRef>(null)

  const tourKey = course?.codeTerminal ? 'learn-code' : 'learn'
  const tourSteps = getStepsForPage(tourKey)
  const totalTourSteps = getTotalSteps(tourKey)
  const activeTourStep = tourSteps[tourCurrentStep]

  useEffect(() => {
    if (!hasHydrated) return
    if (!seenPages?.[tourKey] && !isTourActive) {
      startTour(tourKey)
    }
  }, [hasHydrated, isTourActive, seenPages, startTour, tourKey])

  useEffect(() => {
    const defaultPort = course?.backend?.port
    if (typeof defaultPort === 'number' && defaultPort > 0) {
      setHostPortValue(String(defaultPort))
      setHostPortConflictMessage(null)
      return
    }
    setHostPortValue('')
    setHostPortConflictMessage(null)
  }, [course?.id, course?.backend?.port])

  const effectiveImage = effectiveImageSelector(useLearnStore.getState() as never)
  const imageSourceLabel = imageSourceLabelSelector(useLearnStore.getState() as never)

  const {
    containerId,
    containerStatus,
    isStartingContainer,
    startCourseContainer,
    stopContainer,
    pauseContainer,
    resumeContainer,
    checkExistingContainer,
    handleImagePullComplete,
  } = useLearnContainer(courseId)

  useLearnCourse({ courseId, checkExistingContainer })

  const {
    currentTitle,
    currentContent,
    canGoPrevious,
    canGoNext,
    goToPrevious,
    goToNext,
  } = useCourseProgress({ course, currentStep, setCurrentStep })

  const onExecClick = useExecCommand({
    course,
    containerId,
    containerStatus,
    sqlTerminalRef,
    terminalRef,
    codeTerminalRef,
  })
  const markdownLocalPort = hostPortValue.trim() || (typeof course?.backend?.port === 'number' && course.backend.port > 0 ? String(course.backend.port) : '')
  const renderMarkdown = useLearnMarkdown(onExecClick, markdownLocalPort)

  const {
    handleBackClick,
    handleExitClick,
    handleConfirmExit,
    handleCancelExit,
    handleResetProgress,
    handleConfirmReset,
  } = useLearnActions({ stopContainer })

  const handlePortConflictClose = useCallback(() => setShowPortConflictHandler(false), [setShowPortConflictHandler])
  const showHostPortSelector = typeof course?.backend?.port === 'number' && (course?.backend?.port ?? 0) > 0

  const parseSelectedHostPort = useCallback(() => {
    const parsed = Number.parseInt(hostPortValue.trim(), 10)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return null
    }
    return parsed
  }, [hostPortValue])

  const checkHostPortConflict = useCallback(async (courseIdValue: string, selectedPort: number, signal?: AbortSignal) => {
    setIsHostPortChecking(true)
    try {
      const conflict = await api.courses.checkPortConflict(courseIdValue, selectedPort, signal)
      if (conflict.isConflicted) {
        const containerName = conflict.conflictContainers?.[0]?.name
        setHostPortConflictMessage(
          containerName && containerName !== 'host-process'
            ? `${selectedPort} 已占用（${containerName}）`
            : `已被占用`
        )
        return true
      }
      setHostPortConflictMessage(null)
      return false
    } catch (err) {
      const maybeAbortError = err as { name?: string }
      if (maybeAbortError?.name === 'AbortError') {
        return false
      }
      setHostPortConflictMessage(err instanceof Error ? err.message : '端口检测失败，请稍后重试')
      return true
    } finally {
      setIsHostPortChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!course?.id || !showHostPortSelector) return
    const selectedPort = parseSelectedHostPort()
    if (selectedPort == null) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void checkHostPortConflict(course.id, selectedPort, controller.signal)
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [checkHostPortConflict, course?.id, parseSelectedHostPort, showHostPortSelector])

  const handleStartWithPort = useCallback(async () => {
    if (!course?.id) return
    if (!showHostPortSelector) {
      await startCourseContainer(course.id)
      return
    }

    const selectedPort = parseSelectedHostPort()
    if (selectedPort == null) {
      setHostPortConflictMessage('请输入 1-65535 之间的有效主机端口')
      return
    }

    try {
      const hasConflict = await checkHostPortConflict(course.id, selectedPort)
      if (hasConflict) {
        return
      }

      await startCourseContainer(course.id, selectedPort)
    } catch (err) {
      setHostPortConflictMessage(err instanceof Error ? err.message : '端口检测失败，请稍后重试')
    }
  }, [checkHostPortConflict, course?.id, parseSelectedHostPort, showHostPortSelector, startCourseContainer])

  const handlePortConflictRetry = useCallback(() => {
    void handleStartWithPort()
  }, [handleStartWithPort])
  const handlePortConflictSuccess = useCallback(() => setShowPortConflictHandler(false), [setShowPortConflictHandler])

  if (course && course.id !== courseId) return <LearnLoadingState />
  if (loading || isLoadingProgress) return <LearnLoadingState />
  if (error || !course) return <LearnErrorState error={error} errorInfo={error ? getErrorInfo(error) : getCourseNotFoundError()} />

  const canPickImage = containerStatus === 'stopped' || containerStatus === 'error' || containerStatus === 'exited' || containerStatus === 'completed'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <LearnTopBar
        title={course.title}
        containerStatus={containerStatus}
        isStartingContainer={isStartingContainer}
        imageSourceLabel={imageSourceLabel}
        effectiveImage={effectiveImage}
        canPickImage={canPickImage}
        onBack={handleBackClick}
        onOpenTour={() => startTour(tourKey)}
        onOpenImageSelector={() => setShowImageSelector(true)}
        showHostPortSelector={showHostPortSelector}
        hostPortValue={hostPortValue}
        hostPortConflictMessage={hostPortConflictMessage}
        isHostPortChecking={isHostPortChecking}
        onHostPortChange={(value) => {
          setHostPortValue(value)
          setHostPortConflictMessage(null)
        }}
        onStart={() => void handleStartWithPort()}
        onResume={() => course?.id && resumeContainer(course.id)}
        onPause={() => course?.id && pauseContainer(course.id)}
        onStop={() => course?.id && stopContainer(course.id)}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Group orientation="horizontal" id="course-layout" className="h-full">
          <Panel defaultSize={50} minSize={30} id="course-content">
            <div className="h-full" data-tour-id="learn-steps">
              <CourseContentPanel
                title={currentTitle}
                tags={course.tags}
                content={currentContent}
                renderMarkdown={renderMarkdown}
                currentStep={currentStep}
                stepsLength={course?.details.steps.length ?? 0}
                onPrev={goToPrevious}
                onNext={goToNext}
                canPrev={canGoPrevious()}
                canNext={canGoNext()}
                onExit={handleExitClick}
                onReset={handleResetProgress}
              />
            </div>
          </Panel>
          <Separator className="w-1 bg-[var(--color-border-light)] hover:bg-[var(--color-border-default)] transition-colors cursor-col-resize" />
          <Panel defaultSize={50} minSize={30} id="terminal">
            <LearnTerminalPanel
              course={course}
              containerId={containerId}
              containerStatus={containerStatus}
              isStartingContainer={isStartingContainer}
              terminalRef={terminalRef}
              sqlTerminalRef={sqlTerminalRef}
              codeTerminalRef={codeTerminalRef}
              onImagePullComplete={handleImagePullComplete}
            />
          </Panel>
        </Group>
      </div>
      <LearnDialogs
        course={course}
        showConfirmDialog={showConfirmDialog}
        showResetDialog={showResetDialog}
        showImageSelector={showImageSelector}
        showPortConflictHandler={showPortConflictHandler}
        isTourActive={isTourActive}
        activeTourStep={activeTourStep}
        tourCurrentStep={tourCurrentStep}
        totalTourSteps={totalTourSteps}
        onConfirmExit={handleConfirmExit}
        onCancelExit={handleCancelExit}
        onConfirmReset={handleConfirmReset}
        onCancelReset={() => setShowResetDialog(false)}
        onPortConflictClose={handlePortConflictClose}
        onPortConflictRetry={handlePortConflictRetry}
        onPortConflictSuccess={handlePortConflictSuccess}
        onImageSelect={(image) => {
          setSelectedImage(image)
          setSelectedImageSourceId(useLearnStore.getState().selectedImageSourceId)
        }}
        onImageSelectorClose={() => setShowImageSelector(false)}
        onNextTour={nextStep}
        onPrevTour={prevStep}
        onSkipTour={skipTour}
      />
    </div>
  )
}
