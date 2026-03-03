import React, { useCallback, useEffect, useRef } from 'react'
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
  const renderMarkdown = useLearnMarkdown(onExecClick)

  const {
    handleBackClick,
    handleExitClick,
    handleConfirmExit,
    handleCancelExit,
    handleResetProgress,
    handleConfirmReset,
  } = useLearnActions({ stopContainer })

  const handlePortConflictClose = useCallback(() => setShowPortConflictHandler(false), [setShowPortConflictHandler])
  const handlePortConflictRetry = useCallback(() => {
    if (course?.id) startCourseContainer(course.id)
  }, [course?.id, startCourseContainer])
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
        onStart={() => course?.id && startCourseContainer(course.id)}
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
          setSelectedImageSourceId(localStorage.getItem('imageSourceId')?.trim() || '')
        }}
        onImageSelectorClose={() => setShowImageSelector(false)}
        onNextTour={nextStep}
        onPrevTour={prevStep}
        onSkipTour={skipTour}
      />
    </div>
  )
}
