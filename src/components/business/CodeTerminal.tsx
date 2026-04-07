import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import CodeEditor from './CodeEditor'
import CodeExecutionResult from './CodeExecutionResult'
import ImagePullProgressOverlay, { ImagePullProgressMessageOverlay } from './terminal/ImagePullProgressOverlay'
import { useTheme } from '../../hooks/useTheme'

type Props = {
  courseId: string
  containerId: string
  containerStatus?: string
  imagePullProgress?: ImagePullProgressMessageOverlay | null
  showImagePullProgress?: boolean
  onImagePullComplete?: () => void
}

type ExecutionResult = {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

type LanguageOption = {
  value: string
  label: string
}

const ALL_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
  { value: 'node', label: 'Node.js' },
  { value: 'java', label: 'Java' }
]

const COURSE_LANGUAGE_MAP: Record<string, string[]> = {
  'python-kwdb': ['python', 'bash'],
  'java-kwdb': ['java', 'bash']
}

export interface CodeTerminalRef {
  executeCode: (code: string, language?: string) => void
  cancelExecution: () => void
  getCode: () => string
  setCode: (code: string) => void
}

const CodeTerminal = forwardRef<CodeTerminalRef, Props>(({ courseId, containerId, containerStatus, onImagePullComplete }, ref) => {
  const { isDark } = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [codeText, setCodeText] = useState<string>('')
  const [language, setLanguage] = useState<string>('python')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)
  // 镜像拉取进度状态
  const [showProgress, setShowProgress] = useState(false)
  const [localImagePullProgress, setLocalImagePullProgress] = useState<ImagePullProgressMessageOverlay | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const wsProgressRef = useRef<WebSocket | null>(null)
  const editorRef = useRef<{ getValue: () => string } | null>(null)

  const wsUrl = useMemo(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws/code`
  }, [])

  const availableLanguageOptions = useMemo(() => {
    const allowed = COURSE_LANGUAGE_MAP[courseId]
    if (!allowed || allowed.length === 0) {
      return ALL_LANGUAGE_OPTIONS
    }
    return ALL_LANGUAGE_OPTIONS.filter((option) => allowed.includes(option.value))
  }, [courseId])

  useEffect(() => {
    if (!availableLanguageOptions.some((option) => option.value === language)) {
      setLanguage(availableLanguageOptions[0]?.value || 'python')
    }
  }, [availableLanguageOptions, language])

  const executeCode = useCallback((code: string, lang?: string) => {
    setError(null)
    setResult(null)
    setExecutionId(null)

    if (wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      code.trim()) {

      setExecuting(true)
      const execId = `exec_${Date.now()}`
      setExecutionId(execId)

      const requestedLang = (lang || language).toLowerCase()
      const langToUse = availableLanguageOptions.some((option) => option.value === requestedLang)
        ? requestedLang
        : (availableLanguageOptions[0]?.value || 'python')
      if (langToUse !== language) {
        setLanguage(langToUse)
      }
      const msg = {
        type: 'execute',
        data: {
          containerId,
          language: langToUse,
          code: code,
          timeout: 30
        },
        sessionId: execId
      }
      wsRef.current.send(JSON.stringify(msg))
    } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WS 未连接，无法执行代码')
    }
  }, [availableLanguageOptions, containerId, language])

  const cancelExecution = useCallback(() => {
    if (wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      executionId) {

      const msg = {
        type: 'cancel',
        data: {
          executionId
        }
      }
      wsRef.current.send(JSON.stringify(msg))
      setExecuting(false)
    }
  }, [executionId])

  const setCode = useCallback((code: string) => {
    setCodeText(code)
  }, [])

  useImperativeHandle(ref, () => ({
    executeCode,
    cancelExecution,
    getCode: () => editorRef.current?.getValue() || codeText,
    setCode
  }), [executeCode, cancelExecution, codeText, setCode])

  // 镜像拉取进度 WebSocket 连接
  useEffect(() => {
    if (containerStatus !== 'starting') {
      if (wsProgressRef.current) {
        wsProgressRef.current.close()
        wsProgressRef.current = null
      }
      // 进度结束后隐藏
      if (showProgress) {
        setShowProgress(false)
        setLocalImagePullProgress(null)
      }
      return
    }

    // 防止重复连接
    if (wsProgressRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?progress_only=true`
    const ws = new WebSocket(wsUrl)
    wsProgressRef.current = ws

    ws.onopen = () => {
      console.log('CodeTerminal: 进度专用WebSocket连接已建立')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'image_pull_progress') {
          const payload = msg.data || {}
          setShowProgress(true)
          setLocalImagePullProgress({
            imageName: payload.imageName || '',
            status: payload.status,
            progress: payload.progress,
            error: payload.error,
            progressPercent: payload.progressPercent
          })
          
          // 拉取完成
          if (payload.status === 'done' || payload.status === 'complete') {
            setTimeout(() => {
              setShowProgress(false)
              setLocalImagePullProgress(null)
              // 通知父组件镜像拉取完成
              if (onImagePullComplete) {
                onImagePullComplete()
              }
            }, 1200)
          }
        }
      } catch (error) {
        console.warn('CodeTerminal: 解析进度专用WebSocket消息失败:', error)
      }
    }

    ws.onclose = () => {
      console.log('CodeTerminal: 进度专用WebSocket连接已关闭')
    }

    ws.onerror = (error) => {
      console.error('CodeTerminal: 进度专用WebSocket连接错误:', error)
    }

    return () => {
      ws.close()
      wsProgressRef.current = null
    }
  }, [containerStatus, onImagePullComplete, showProgress])

  // WebSocket connection
  useEffect(() => {
    if (containerStatus !== 'running') {
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore close errors */ }
        wsRef.current = null
      }
      setWsConnected(false)
      return
    }

    if (wsRef.current) return

    const sessionId = `code_${Date.now()}`
    const ws = new WebSocket(`${wsUrl}?sessionId=${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
    }

    ws.onmessage = (ev) => {
      try {
        type WsMessage = {
          type: string
          output?: string
          error?: string
          exitCode?: number
          duration?: number
          executionId?: string
          [key: string]: unknown
        }
        const msg: WsMessage = JSON.parse(ev.data)

        if (msg.type === 'output') {
          setResult(prev => {
            const output = typeof msg.output === 'string' ? msg.output : ''
            return {
              stdout: (prev?.stdout || '') + output,
              stderr: prev?.stderr || '',
              exitCode: prev?.exitCode || 0,
              duration: prev?.duration || 0
            }
          })
          return
        }

        if (msg.type === 'error') {
          setExecuting(false)
          const errorMsg = typeof msg.error === 'string' ? msg.error : '执行错误'
          setError(errorMsg)
          setResult(prev => ({
            stdout: prev?.stdout || '',
            stderr: errorMsg,
            exitCode: typeof msg.exitCode === 'number' ? msg.exitCode : 1,
            duration: typeof msg.duration === 'number' ? msg.duration : 0
          }))
          return
        }

        if (msg.type === 'done') {
          setExecuting(false)
          const stdout = typeof msg.output === 'string' ? msg.output : ''
          const stderr = typeof msg.error === 'string' ? msg.error : ''
          const exitCode = typeof msg.exitCode === 'number' ? msg.exitCode : 0
          const duration = typeof msg.duration === 'number' ? msg.duration : 0

          setResult({ stdout, stderr, exitCode, duration })
          return
        }

        if (msg.type === 'pong') {
          return
        }
      } catch (e) {
        console.error('WS 消息解析失败:', e)
        setExecuting(false)
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      wsRef.current = null
      setExecuting(false)
    }

    ws.onerror = (err) => {
      console.error('WS 错误:', err)
      setError('WebSocket 连接错误')
      setWsConnected(false)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [wsUrl, containerStatus])

  const runCode = () => {
    setError(null)
    setResult(null)
    executeCode(codeText, language)
  }

  const handleClearInput = () => {
    setCodeText('')
    setResult(null)
    setError(null)
  }

  const showDisconnectedState = containerStatus !== 'running' && containerStatus !== 'starting'

  return (
    <div className="relative h-full flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20 text-xs">编辑器</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={executing}
            className="text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded px-2 py-1 text-[var(--color-text-secondary)]"
          >
            {availableLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-xs ${wsConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
            {wsConnected ? '已连接' : '未连接'}
          </div>
        </div>
      </div>

      {/* 主内容区域 - 使用固定比例布局 */}
      <div className="flex-1 flex flex-col min-h-0">
        {showDisconnectedState ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-bg-secondary)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
              <svg className="h-6 w-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">终端未连接</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">启动容器后即可使用 Code 终端</p>
          </div>
        ) : (
          <>
            <div className="h-[55%] flex flex-col border-b border-[var(--color-border-light)] min-h-0" data-tour-id="learn-code-editor">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
                <span className="text-xs text-[var(--color-text-tertiary)]">代码</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearInput}
                    disabled={executing}
                    className={`btn btn-ghost text-xs ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    清空
                  </button>
                  {executing ? (
                    <button
                      onClick={cancelExecution}
                      className="btn text-xs bg-[var(--color-error)] text-[var(--color-error-on-accent)] hover:bg-[var(--color-error)]/80"
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={runCode}
                      disabled={!wsConnected || !codeText.trim()}
                      data-tour-id="learn-code-run"
                      className={`btn text-xs ${!wsConnected || !codeText.trim() ? 'opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                    >
                      运行
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <CodeEditor
                  ref={editorRef}
                  value={codeText}
                  onChange={setCodeText}
                  language={language}
                  isDark={isDark}
                />
              </div>
            </div>

            <div className="h-[45%] flex flex-col min-h-0" data-tour-id="learn-code-output">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
                <span className="text-xs text-[var(--color-text-tertiary)]">输出</span>
                {executing && (
                  <span className="text-xs text-[var(--color-warning)]">运行中...</span>
                )}
              </div>
              <div className="flex-1 overflow-auto bg-[var(--color-bg-primary)] p-3">
                {error && (
                  <div className="mb-3 rounded border border-[var(--color-error)] bg-[var(--color-error)]/10 p-3">
                    <div className="font-mono text-sm text-[var(--color-error)]">{error}</div>
                  </div>
                )}
                <CodeExecutionResult
                  stdout={result?.stdout || ''}
                  stderr={result?.stderr || ''}
                />
                {result && (
                  <div className="mt-3 flex items-center justify-between rounded bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
                    <span>退出码: {result.exitCode}</span>
                    <span>耗时: {result.duration}ms</span>
                  </div>
                )}
                {!result && !error && !executing && (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
                    点击「运行」执行代码
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 镜像拉取进度覆盖层 */}
      {showProgress && localImagePullProgress && (
        <div className="absolute inset-0 z-50">
          <ImagePullProgressOverlay
            show={showProgress}
            imagePullProgress={localImagePullProgress}
          />
        </div>
      )}
    </div>
  )
})

CodeTerminal.displayName = 'CodeTerminal'

export default CodeTerminal
