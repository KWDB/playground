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
  backend?: {
    port?: number
    imageid?: string
  }
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
  hasConflict: boolean
  conflictingContainerId?: string
  conflictingPort?: number
  courseId?: string
}

export interface UserProgress {
  userId: string
  courseId: string
  stepIndex: number
  completed: boolean
  createdAt: string
  updatedAt: string
}
