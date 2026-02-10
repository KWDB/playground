// KWDB Playground 共享类型定义
// 集中管理前端共享类型，避免重复定义

// ============================================
// 容器相关类型
// ============================================

export type ContainerState = 
  | 'creating' 
  | 'starting' 
  | 'running' 
  | 'paused' 
  | 'stopped' 
  | 'exited' 
  | 'error'

export interface ContainerInfo {
  id: string
  courseId: string
  dockerId: string
  state: ContainerState
  image: string
  startedAt: string
  message?: string
  name?: string
  port?: number
  exitCode?: number
  env?: Record<string, string>
  ports?: Record<string, string>
  privileged?: boolean
}

// 后端 API 返回的 CleanupResult 类型
export interface CleanupResult {
  success: boolean
  message: string
  cleanedContainers: ContainerInfo[]
}

// 前端组件内部使用的扩展 CleanupResult（包含额外字段）
export interface ExtendedCleanupResult {
  success?: boolean
  message?: string
  cleanedContainers?: ContainerInfo[]
  courseId?: string
  totalCleaned?: number
  errors?: string[]
}

// ============================================
// 端口冲突相关类型
// ============================================

export interface PortConflictInfo {
  courseId: string
  port: string
  isConflicted: boolean
  conflictContainers: ContainerInfo[]
}

export type ConflictHandlingStatus = 
  | 'idle'
  | 'checking'
  | 'cleaning'
  | 'retrying'
  | 'success'
  | 'error'

export interface PortConflictHandlerProps {
  courseId: string
  port: number
  isVisible: boolean
  onClose: () => void
  onRetry: () => void
  onSuccess?: () => void
}

export interface PortConflictHandlerState {
  status: ConflictHandlingStatus
  conflictInfo: PortConflictInfo | null
  cleanupResult: ExtendedCleanupResult | null
  error: string | null
  isProcessing: boolean
}

// ============================================
// API 响应类型
// ============================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export type PortConflictCheckResponse = ApiResponse<PortConflictInfo>
export type ContainerCleanupResponse = ApiResponse<CleanupResult>

// ============================================
// 课程相关类型
// ============================================

export interface Course {
  id: string
  name: string
  description: string
  image: string
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  steps: CourseStep[]
}

export interface CourseStep {
  id: string
  title: string
  content: string
  order: number
}

// ============================================
// SQL 相关类型
// ============================================

export interface SqlQueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  executionTime: number
}

export interface SqlInfo {
  version: string
  database: string
  user: string
  host: string
  port: number
}

export interface SqlHealth {
  status: 'healthy' | 'unhealthy'
  latency: number
  error?: string
}

// ============================================
// WebSocket 消息类型
// ============================================

export type WebSocketMessageType = 
  | 'input' 
  | 'output' 
  | 'error' 
  | 'image_pull_progress' 
  | 'ping' 
  | 'pong'

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType
  data: T
  meta?: unknown
}

export interface ImagePullProgress {
  progress: number
  status: string
  current?: string
  total?: string
}
