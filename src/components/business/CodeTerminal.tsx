import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import CodeEditor from './CodeEditor'
import CodeExecutionResult from './CodeExecutionResult'
import ImagePullProgressOverlay, { ImagePullProgressMessageOverlay } from './terminal/ImagePullProgressOverlay'

type Props = {
  courseId: string
  containerId: string
  containerStatus?: string
  imagePullProgress?: ImagePullProgressMessageOverlay | null
  showImagePullProgress?: boolean
}

type ExecutionResult = {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

export interface CodeTerminalRef {
  executeCode: (code: string, language?: string) => void
  cancelExecution: () => void
  getCode: () => string
  setCode: (code: string) => void
}

const CodeTerminal = forwardRef<CodeTerminalRef, Props>(({ courseId, containerId, containerStatus, imagePullProgress, showImagePullProgress }, ref) => {
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [codeText, setCodeText] = useState<string>('')
  const [language, setLanguage] = useState<string>('python')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const editorRef = useRef<{ getValue: () => string } | null>(null)

  const wsUrl = useMemo(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws/code`
  }, [])

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

      const langToUse = lang || language
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
  }, [containerId, language])

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

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
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
            <option value="python">Python</option>
            <option value="bash">Bash</option>
            <option value="node">Node.js</option>
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
        {/* 上半部分：代码编辑器 - 55% 高度 */}
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
                  className="btn text-xs bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/80"
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
            />
          </div>
        </div>

        {/* 下半部分：终端输出 - 45% 高度 */}
        <div className="h-[45%] flex flex-col min-h-0" data-tour-id="learn-code-output">
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
            <span className="text-xs text-[var(--color-text-tertiary)]">输出</span>
            {executing && (
              <span className="text-xs text-[var(--color-warning)]">运行中...</span>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-[var(--color-bg-primary)] p-3">
            {/* 错误提示 */}
            {error && (
              <div className="mb-3 p-3 border border-[var(--color-error)] bg-[var(--color-error)]/10 rounded">
                <div className="text-sm text-[var(--color-error)] font-mono">{error}</div>
              </div>
            )}
            {/* 执行结果 */}
            <CodeExecutionResult
              stdout={result?.stdout || ''}
              stderr={result?.stderr || ''}
            />
            {/* 状态信息 */}
            {result && (
              <div className="mt-3 px-3 py-2 text-xs text-[var(--color-text-tertiary)] flex items-center justify-between bg-[var(--color-bg-secondary)] rounded">
                <span>退出码: {result.exitCode}</span>
                <span>耗时: {result.duration}ms</span>
              </div>
            )}
            {!result && !error && !executing && (
              <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)] text-sm">
                点击「运行」执行代码
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 镜像拉取进度覆盖层 */}
      {showImagePullProgress && imagePullProgress && (
        <div className="absolute inset-0 z-50">
          <ImagePullProgressOverlay
            show={showImagePullProgress}
            imagePullProgress={imagePullProgress}
          />
        </div>
      )}
    </div>
  )
})

CodeTerminal.displayName = 'CodeTerminal'

export default CodeTerminal