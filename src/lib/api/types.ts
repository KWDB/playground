// API Response Types

export interface Course {
  id: string
  title: string
  description: string
  details: {
    intro: { content: string }
    steps: Array<{ title: string; content: string }>
    finish: { content: string }
  }
  sqlTerminal?: boolean
  codeTerminal?: boolean
  backend?: {
    port?: number
    imageid?: string
  }
  tags?: string[]
  difficulty?: string
  estimatedMinutes?: number
}

export interface ContainerStatusResponse {
  status: ContainerStatus
  exitCode?: number
}

export type ContainerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'paused'
  | 'exited'
  | 'error'
  | 'completed'
  | 'stopping'

export interface ContainerInfo {
  id: string
  courseId: string
  dockerId: string
  state: 'creating' | 'starting' | 'running' | 'paused' | 'stopped' | 'exited' | 'error'
  image: string
  startedAt: string
  message?: string
  name?: string
}

export interface CleanupResult {
  success: boolean
  message: string
  cleanedContainers: ContainerInfo[]
}

export interface StartCourseResponse {
  containerId: string
}

export interface SqlInfo {
  connected: boolean
  port: number
  version: string
  arch: string
  buildTime: string
  message?: string
}

export interface ApiError {
  error: string
  message?: string
}

export interface PortConflictInfo {
  courseId?: string
  port?: string
  isConflicted: boolean
  conflictContainers: Array<{
    id: string
    name: string
    courseId: string
    port: string
    state: string
  }>
}

// Backend raw response from /progress/:courseId
export interface UserProgressRaw {
  user_id: string
  course_id: string
  current_step: number
  completed: boolean
  started_at: string
  updated_at: string
  completed_at?: string | null
}

// Normalized frontend type
export interface UserProgress {
  userId: string
  courseId: string
  stepIndex: number
  completed: boolean
  createdAt: string
  updatedAt: string
}

// Progress endpoint response
export interface GetProgressResponse {
  progress: UserProgressRaw | null
  exists: boolean
}

export interface CourseImageDiagnosticResult {
  courseId: string
  title: string
  imageName: string
  available: boolean
  localCached: boolean
  localImageSizeBytes: number
  message: string
  checkedAt: string
  sourceHint: string
}

export interface CourseImageDiagnosticsResponse {
  results: CourseImageDiagnosticResult[]
}

export interface PreloadCourseImagesRequest {
  courseIds?: string[]
  imageOverrides?: Record<string, string>
}

export interface PreloadCourseImageResult {
  courseId: string
  title: string
  imageName: string
  status: 'cached' | 'pulled' | 'failed'
  message: string
}

export interface PreloadCourseImagesResponse {
  total: number
  successCount: number
  results: PreloadCourseImageResult[]
}

export interface CleanupCourseImagesRequest {
  imageNames?: string[]
  sourcePrefix?: string
}

export type LocalImageCleanupStatus = 'removed' | 'failed' | 'skipped'

export interface LocalImageCleanupItem {
  imageName: string
  status: LocalImageCleanupStatus
  message: string
  courseIds: string[]
  courseTitles: string[]
  releasedBytes: number
}

export interface LocalImageCleanupResult {
  success: boolean
  message: string
  total: number
  successCount: number
  failureCount: number
  removedCount: number
  totalReleasedBytes: number
  results: LocalImageCleanupItem[]
}
