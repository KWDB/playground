import type { UserProgressRaw } from '@/lib/api/types'
import type { UserProgress } from '@/lib/api/types'

export function normalizeProgress(raw: UserProgressRaw | null): UserProgress | null {
  if (!raw) return null

  return {
    userId: raw.user_id,
    courseId: raw.course_id,
    stepIndex: raw.current_step,
    completed: raw.completed,
    createdAt: raw.started_at,
    updatedAt: raw.updated_at,
  }
}
