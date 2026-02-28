import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import CodeExecutionResult from './CodeExecutionResult'

type Props = {
  courseId: string
  containerId: string
  containerStatus?: string
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
}

const CodeTerminal = forwardRef<CodeTerminalRef, Props>(({ courseId, containerId, containerStatus }, ref) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [codeText, setCodeText] = useState<string>('')
  const [language, setLanguage] = useState<string>('python')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)

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

  useImperativeHandle(ref, () => ({
    executeCode,
    cancelExecution
  }), [executeCode, cancelExecution])

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
          // Stream output - append to result
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
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2 py-0.5 rounded bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20">代码</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={executing}
            className="text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded px-2 py-1 text-[var(--color-text-secondary)]"
          >
            <option value="python">Python</option>
            <option value="bash">Bash</option>
            <option value="node">Node.js</option>
          </select>
        </div>
        <div className={`text-xs ${wsConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
          {wsConnected ? 'WS 已连接' : 'WS 未连接'}
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {containerStatus !== 'running' && (
          <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg-secondary)] p-6">
            <div className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm mb-2">终端未连接</p>
            <p className="text-[var(--color-text-tertiary)] text-xs">启动容器后即可使用代码执行</p>
          </div>
        )}

        {containerStatus === 'running' && (
          <>
            {/* 代码输入区域 */}
            <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-[var(--color-text-tertiary)]">代码输入</div>
              </div>
              <textarea
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                placeholder="输入要执行的代码..."
                disabled={executing}
                className="w-full h-40 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-sm font-mono text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-accent-primary)]"
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {executing && <span className="text-[var(--color-warning)]">执行中...</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearInput}
                    disabled={executing}
                    className={`btn btn-ghost text-sm ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="清除代码"
                  >
                    清除
                  </button>
                  {executing && (
                    <button
                      onClick={cancelExecution}
                      className="btn text-sm bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/80"
                    >
                      取消
                    </button>
                  )}
                  <button
                    onClick={runCode}
                    disabled={executing || !wsConnected || !codeText.trim()}
                    className={`btn text-sm ${executing || !wsConnected || !codeText.trim()
                      ? 'opacity-50 cursor-not-allowed'
                      : 'btn-primary'
                    }`}
                  >
                    {executing ? '执行中...' : '执行'}
                  </button>
                </div>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded border border-[var(--color-error)] bg-[var(--color-error)]/10 p-3">
                <div className="text-sm text-[var(--color-error)]">{error}</div>
              </div>
            )}

            {/* 执行结果 */}
            <div className="flex-1 min-h-[200px]">
              <CodeExecutionResult
                stdout={result?.stdout || ''}
                stderr={result?.stderr || ''}
              />
              {result && (
                <div className="mt-2 text-xs text-[var(--color-text-tertiary)] flex items-center justify-between">
                  <span>退出码: {result.exitCode}</span>
                  <span>耗时: {result.duration}ms</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})

CodeTerminal.displayName = 'CodeTerminal'

export default CodeTerminal
