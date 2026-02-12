import type {
  ContainerInfo,
  ContainerStatusResponse,
  Course,
  CleanupResult,
  StartCourseResponse,
  SqlInfo,
  PortConflictInfo,
  UserProgress,
} from './types'

// ApiError 是从 ApiClientError 类重新导出的类型别名
// 这是一个模式：类用于实现，类型别名用于导入

const DEFAULT_TIMEOUT = 30000
const DEFAULT_RETRIES = 2
const BASE_URL = '/api'

class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { timeout?: number; retries?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES } = config
  const url = `${BASE_URL}${endpoint}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type') || ''
      let payload: unknown = null

      if (contentType.includes('application/json')) {
        payload = await response.json().catch(() => ({}))
      } else {
        const text = await response.text().catch(() => '')
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { message: text }
        }
      }

      if (!response.ok) {
        const error = payload as Record<string, unknown>
        const message =
          typeof error?.error === 'string'
            ? error.error
            : typeof error?.message === 'string'
              ? error.message
              : `HTTP ${response.status}`

        throw new ApiClientError(message, response.status, payload)
      }

      return payload as T
    } catch (error) {
      lastError = error as Error

      if (error instanceof ApiClientError && error.statusCode && error.statusCode < 500) {
        throw error
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw lastError
    }
  }

  throw lastError
}

export const api = {
  courses: {
    list: (signal?: AbortSignal): Promise<Course[]> =>
      request<Course[]>('/courses', { signal }),

    get: (id: string, signal?: AbortSignal): Promise<{ course: Course }> =>
      request<{ course: Course }>(`/courses/${id}`, { signal }),

    start: (
      id: string,
      body?: { image?: string },
      signal?: AbortSignal
    ): Promise<StartCourseResponse> =>
      request<StartCourseResponse>(`/courses/${id}/start`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        signal,
      }),

    stop: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/courses/${id}/stop`, { method: 'POST', signal }),

    pause: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/courses/${id}/pause`, { method: 'POST', signal }),

    resume: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/courses/${id}/resume`, { method: 'POST', signal }),

    checkPortConflict: (id: string, port: number, signal?: AbortSignal): Promise<PortConflictInfo> =>
      request<PortConflictInfo>(`/courses/${id}/port-conflict?port=${port}`, { signal }),

    getProgress: (id: string, userId?: string, signal?: AbortSignal): Promise<UserProgress[]> => {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : ''
      return request<UserProgress[]>(`/courses/${id}/progress${query}`, { signal })
    },

    saveProgress: (
      id: string,
      body: { stepIndex: number; completed?: boolean; userId?: string },
      signal?: AbortSignal
    ): Promise<UserProgress> =>
      request<UserProgress>(`/courses/${id}/progress`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      }),

    resetProgress: (id: string, userId?: string, signal?: AbortSignal): Promise<void> => {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : ''
      return request<void>(`/courses/${id}/progress${query}`, { method: 'DELETE', signal })
    },
  },

  containers: {
    list: (signal?: AbortSignal): Promise<ContainerInfo[]> =>
      request<ContainerInfo[]>('/containers', { signal }),

    getStatus: (id: string, signal?: AbortSignal): Promise<ContainerStatusResponse> =>
      request<ContainerStatusResponse>(`/containers/${id}/status`, { signal }),

    stop: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/containers/${id}/stop`, { method: 'POST', signal }),

    pause: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/containers/${id}/pause`, { method: 'POST', signal }),

    resume: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/containers/${id}/unpause`, { method: 'POST', signal }),

    remove: (id: string, signal?: AbortSignal): Promise<void> =>
      request<void>(`/containers/${id}`, { method: 'DELETE', signal }),

    cleanup: (courseId: string, signal?: AbortSignal): Promise<CleanupResult> =>
      request<CleanupResult>(`/containers/cleanup?courseId=${courseId}`, { method: 'POST', signal }),
  },

  sql: {
    info: (courseId: string, signal?: AbortSignal): Promise<SqlInfo> =>
      request<SqlInfo>(`/sql/info?courseId=${encodeURIComponent(courseId)}`, { signal }),

    health: (courseId: string, signal?: AbortSignal): Promise<{ status: string; port: number }> =>
      request<{ status: string; port: number }>(`/sql/health?courseId=${encodeURIComponent(courseId)}`, { signal }),
  },

  images: {
    sources: (signal?: AbortSignal): Promise<Array<{ id: string; tag: string; size: number }>> =>
      request<Array<{ id: string; tag: string; size: number }>>('/images/sources', { signal }),

    checkAvailability: (image: string, signal?: AbortSignal): Promise<{ available: boolean; message: string }> =>
      request<{ available: boolean; message: string }>('/images/check-availability', {
        method: 'POST',
        body: JSON.stringify({ image }),
        signal,
      }),
  },
}

export { ApiClientError }
export type { ApiClientError as ApiError }
