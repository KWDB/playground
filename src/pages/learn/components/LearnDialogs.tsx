import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import PortConflictHandler from '../../../components/business/PortConflictHandler'
import { ImageSelector } from '../../../components/business/ImageSelector'
import { TourTooltip } from '../../../components/ui/TourTooltip'
import { Course } from '../../../store/learnStore'
import { TourStep } from '../../../config/tourSteps'

type Props = {
  course: Course | null
  showConfirmDialog: boolean
  showResetDialog: boolean
  showImageSelector: boolean
  showPortConflictHandler: boolean
  isTourActive: boolean
  activeTourStep?: TourStep
  tourCurrentStep: number
  totalTourSteps: number
  onConfirmExit: () => void
  onCancelExit: () => void
  onConfirmReset: () => void
  onCancelReset: () => void
  onPortConflictClose: () => void
  onPortConflictRetry: () => void
  onPortConflictSuccess: () => void
  onImageSelect: (image: string) => void
  onImageSelectorClose: () => void
  onNextTour: () => void
  onPrevTour: () => void
  onSkipTour: () => void
}

export const LearnDialogs = ({
  course,
  showConfirmDialog,
  showResetDialog,
  showImageSelector,
  showPortConflictHandler,
  isTourActive,
  activeTourStep,
  tourCurrentStep,
  totalTourSteps,
  onConfirmExit,
  onCancelExit,
  onConfirmReset,
  onCancelReset,
  onPortConflictClose,
  onPortConflictRetry,
  onPortConflictSuccess,
  onImageSelect,
  onImageSelectorClose,
  onNextTour,
  onPrevTour,
  onSkipTour,
}: Props) => {
  return (
    <>
      <ConfirmDialog isOpen={showConfirmDialog} title="确认退出课程" message="确认要退出当前课程吗？" confirmText="确定" cancelText="取消" onConfirm={onConfirmExit} onCancel={onCancelExit} variant="warning" />
      <ConfirmDialog isOpen={showResetDialog} title="重置进度" message="确定要重置当前课程的学习进度吗？将会回到课程介绍页。" confirmText="确定重置" cancelText="取消" onConfirm={onConfirmReset} onCancel={onCancelReset} variant="danger" />
      {course?.id && course?.backend?.port != null && (
        <PortConflictHandler courseId={course.id} port={course.backend.port} isVisible={showPortConflictHandler} onClose={onPortConflictClose} onRetry={onPortConflictRetry} onSuccess={onPortConflictSuccess} />
      )}
      {course?.id && (
        <ImageSelector defaultImage={course?.backend?.imageid || 'kwdb/kwdb:latest'} onImageSelect={onImageSelect} isOpen={showImageSelector} onClose={onImageSelectorClose} />
      )}
      {activeTourStep && (
        <TourTooltip
          isOpen={isTourActive && !showConfirmDialog && !showResetDialog && !showImageSelector && !showPortConflictHandler}
          step={activeTourStep}
          currentStep={tourCurrentStep}
          totalSteps={totalTourSteps}
          onNext={onNextTour}
          onPrev={onPrevTour}
          onSkip={onSkipTour}
        />
      )}
    </>
  )
}
