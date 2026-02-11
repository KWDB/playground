import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import EnhancedSqlEditor from './EnhancedSqlEditor'
import { api } from '@/lib/api/client'

type Props = {
  courseId: string
  port: number
  containerStatus?: string
}

type SqlInfo = {
  version?: string
  port?: number
  connected?: boolean
}

type ExecutionResult = {
  type: 'success' | 'query' | 'error'
  message?: string
  rowsAffected?: number
  columns?: string[]
  rows?: (string | number | boolean | null)[][]
}

export interface SqlTerminalRef {
  sendCommand: (command: string) => void
}

type TzMode = 'UTC' | 'LOCAL'

const isTimestampColumnName = (name: string): boolean => /^(ts|tt|.*time.*|.*timestamp.*)$/i.test(name)

const pad2 = (n: number) => String(n).padStart(2, '0')

const formatUtc = (date: Date): string => {
  const y = date.getUTCFullYear()
  const m = pad2(date.getUTCMonth() + 1)
  const d = pad2(date.getUTCDate())
  const hh = pad2(date.getUTCHours())
  const mm = pad2(date.getUTCMinutes())
  const ss = pad2(date.getUTCSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const formatLocalShanghai = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).replace(/\//g, '-').replace(/,/g, '')
}

const parseTimestampAsUtc = (raw: string): Date | null => {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?$/)
  if (m) {
    const [, yy, MM, dd, hh, mm, ss] = m
    const ms = Date.UTC(
      Number(yy), Number(MM) - 1, Number(dd),
      Number(hh), Number(mm), Number(ss)
    )
    return new Date(ms)
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const formatCellValue = (value: unknown, columnName: string, tzMode: TzMode): string => {
  if (value === null || value === undefined) return 'NULL'

  const isTs = isTimestampColumnName(columnName)
  if (isTs && typeof value === 'string') {
    const d = parseTimestampAsUtc(value)
    if (d) {
      return tzMode === 'UTC' ? formatUtc(d) : formatLocalShanghai(d)
    }
  }
  return String(value)
}

const SqlTerminal = forwardRef<SqlTerminalRef, Props>(({ courseId, port, containerStatus }, ref) => {
  const [info, setInfo] = useState<SqlInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [queryText, setQueryText] = useState<string>('')
  const [columns, setColumns] = useState<string[]>([])
  type Cell = string | number | boolean | null
  const [rows, setRows] = useState<Cell[][]>([])
  const [executing, setExecuting] = useState(false)
  const [lastExecutionResult, setLastExecutionResult] = useState<ExecutionResult | null>(null)
  const [tzMode, setTzMode] = useState<TzMode>('UTC')
  const [justCleared, setJustCleared] = useState(false)

  const hasTimestampColumn = useMemo(() => {
    return columns.some((c) => isTimestampColumnName(c))
  }, [columns])

  const wsRef = useRef<WebSocket | null>(null)
  const infoAbortControllerRef = useRef<AbortController | null>(null)

  const infoUrl = useMemo(() => `/api/sql/info?courseId=${encodeURIComponent(courseId)}`, [courseId])

  const wsUrl = useMemo(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws/sql`
  }, [])

  const sendCommand = useCallback((command: string) => {
    setQueryText(command)
    setError(null)
    setLastExecutionResult(null)
    setColumns([])
    setRows([])

    if (wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      !executing &&
      command.trim()) {

      setExecuting(true)
      const qid = `q_${Date.now()}`
      const msg = { type: 'query', queryId: qid, sql: command }
      wsRef.current.send(JSON.stringify(msg))
    } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WS 未连接，无法执行命令')
    } else if (executing) {
      setError('正在执行其他命令，请稍后再试')
    }
  }, [executing])

  useImperativeHandle(ref, () => ({
    sendCommand
  }), [sendCommand])

  const fetchInfo = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.sql.info(courseId, signal)
      setInfo(data)
    } catch (e) {
      const maybeAbort = e as { name?: string }
      if (maybeAbort?.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || '未知错误')
    } finally {
      setLoading(false)
    }
  }, [infoUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    infoAbortControllerRef.current?.abort()
    const controller = new AbortController()
    infoAbortControllerRef.current = controller
    fetchInfo(controller.signal)

    return () => {
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
    }
  }, [fetchInfo])

  useEffect(() => {
    if (containerStatus !== 'running') {
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore close errors */ }
        wsRef.current = null
      }
      setWsConnected(false)
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
      return
    }

    if (wsRef.current) return
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      const initMsg = { type: 'init', courseId }
      ws.send(JSON.stringify(initMsg))
    }

    ws.onmessage = (ev) => {
      try {
        type WsMessage = { type: string;[key: string]: unknown }
        const msg: WsMessage = JSON.parse(ev.data)

        if (msg.type === 'ready') {
          fetchInfoRef.current()
          return
        }

        if (msg.type === 'info') {
          setInfo({
            version: typeof msg.version === 'string' ? msg.version : undefined,
            port: typeof msg.port === 'number' ? msg.port : undefined,
            connected: Boolean(msg.connected),
          })
          setLoading(false)
          setError(null)
          return
        }

        if (msg.type === 'result') {
          const cols = Array.isArray(msg.columns) ? msg.columns : []
          const rws = Array.isArray(msg.rows) ? msg.rows : []
          const rowCount = typeof msg.rowCount === 'number' ? msg.rowCount : 0

          const hasCols = cols.length > 0
          const hasRws = rws.length > 0

          if (hasCols) {
            setColumns(cols)
            setRows(rws)
            setLastExecutionResult({
              type: 'query',
              columns: cols,
              rows: rws,
              message: `查询完成，返回 ${hasRws ? rws.length : 0} 行数据`
            })
          } else {
            setColumns([])
            setRows([])
            setLastExecutionResult({
              type: 'success',
              message: rowCount > 0 ? `操作成功，影响 ${rowCount} 行数据` : '操作成功',
              rowsAffected: rowCount
            })
          }
          setExecuting(false)
          return
        }

        if (msg.type === 'success') {
          setExecuting(false)
          const rowsAffected = typeof msg.rowsAffected === 'number' ? msg.rowsAffected : undefined
          const message = typeof msg.message === 'string' ? msg.message : '操作成功'
          setColumns([])
          setRows([])
          setLastExecutionResult({
            type: 'success',
            message,
            rowsAffected
          })
          return
        }

        if (msg.type === 'error') {
          setExecuting(false)
          const message = typeof (msg as { message?: unknown }).message === 'string'
            ? (msg as { message?: string }).message
            : '执行错误'
          setError(message)
          setLastExecutionResult({
            type: 'error',
            message
          })
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

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [wsUrl, courseId, containerStatus])

  useEffect(() => {
    if (containerStatus !== 'running' || info?.connected) return

    const timer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const initMsg = { type: 'init', courseId }
        wsRef.current.send(JSON.stringify(initMsg))
        fetchInfoRef.current()
      }
    }, 1200)

    return () => { clearInterval(timer) }
  }, [courseId, info?.connected, containerStatus])

  useEffect(() => {
    return () => {
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
    }
  }, [])

  const runQuery = (sqlOverride?: string) => {
    setError(null)
    setLastExecutionResult(null)
    setColumns([])
    setRows([])

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WS 未连接，无法执行')
      return
    }

    setExecuting(true)

    const qid = `q_${Date.now()}`
    const msg = { type: 'query', queryId: qid, sql: (sqlOverride ?? queryText) }
    wsRef.current.send(JSON.stringify(msg))
  }

  const handleClearInput = () => {
    setQueryText('')
    setJustCleared(true)
    setTimeout(() => setJustCleared(false), 1000)
  }

  const fetchInfoRef = useRef<() => void>(() => { })
  useEffect(() => {
    fetchInfoRef.current = () => {
      infoAbortControllerRef.current?.abort()
      const controller = new AbortController()
      infoAbortControllerRef.current = controller
      fetchInfo(controller.signal)
    }
  }, [fetchInfo])

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2 py-0.5 rounded bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/20">SQL</span>
          <span className="text-[var(--color-text-secondary)]">端口: {port}</span>
        </div>
        <button
          onClick={() => fetchInfoRef.current()}
          className="btn btn-ghost text-sm"
        >刷新</button>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {loading && containerStatus === 'running' && <div className="text-[var(--color-text-tertiary)] text-sm">正在加载连接信息...</div>}
        {error && <div className="text-[var(--color-error)] text-sm">{error}</div>}
        {!loading && !error && containerStatus === 'running' && (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3">
              <div className="text-xs text-[var(--color-text-tertiary)] mb-1">KWDB 版本</div>
              <div className="text-sm text-[var(--color-text-primary)]">{info?.version || '未知'}</div>
            </div>
          </div>
        )}

        {containerStatus !== 'running' && (
          <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
            请启动容器以连接终端
          </div>
        )}

        {containerStatus === 'running' && (
          <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[var(--color-text-tertiary)]">执行区</div>
              <div className={`text-xs ${wsConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>{wsConnected ? 'WS 已连接' : 'WS 未连接'}</div>
            </div>
            <EnhancedSqlEditor
              value={queryText}
              onChange={setQueryText}
              placeholder="输入 SQL，最后一行按 Enter 或点击执行"
              className="w-full bg-[var(--color-bg-primary)]"
              disabled={executing}
              onEnterExecute={(text) => {
                if (executing) return
                setQueryText(text)
                runQuery(text)
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-[var(--color-text-tertiary)]">
                提示：在编辑器最后一行按 Enter 可执行；按 Shift+Enter 换行。
                {justCleared && (
                  <span className="ml-2 text-[var(--color-success)]">已清除输入</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearInput}
                  className={`btn btn-ghost text-sm${justCleared ? ' opacity-80' : ''}`}
                  aria-label="清除输入"
                >
                  {justCleared ? '已清除' : '清除'}
                </button>
                <button
                  onClick={() => runQuery()}
                  disabled={executing || !wsConnected}
                  className={`btn text-sm ${executing || !wsConnected
                    ? 'opacity-50 cursor-not-allowed'
                    : 'btn-primary'
                    }`}
                >
                  {executing ? '执行中...' : '执行'}
                </button>
              </div>
            </div>

            {lastExecutionResult && (
              <div className="mt-3">
                {lastExecutionResult.type === 'success' && (
                  <div className="rounded border border-[var(--color-success)] bg-[var(--color-success)]/10 p-3">
                    <div className="text-sm text-[var(--color-success)]">
                      {lastExecutionResult.message}
                    </div>
                  </div>
                )}

                {lastExecutionResult.type === 'error' && (
                  <div className="rounded border border-[var(--color-error)] bg-[var(--color-error)]/10 p-3">
                    <div className="text-sm text-[var(--color-error)]">{lastExecutionResult.message}</div>
                  </div>
                )}
              </div>
            )}

            {columns.length > 0 && (
              <div className="mt-3 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[var(--color-text-tertiary)]">查询结果</div>
                  {hasTimestampColumn && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-tertiary)]">时区</span>
                      <div className="inline-flex rounded border border-[var(--color-border-default)] overflow-hidden">
                        <button
                          className={`px-2 py-1 text-xs ${tzMode === 'UTC' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
                          onClick={() => setTzMode('UTC')}
                          aria-pressed={tzMode === 'UTC'}
                        >UTC</button>
                        <button
                          className={`px-2 py-1 text-xs ${tzMode === 'LOCAL' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
                          onClick={() => setTzMode('LOCAL')}
                          aria-pressed={tzMode === 'LOCAL'}
                        >UTC+8</button>
                      </div>
                    </div>
                  )}
                </div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {columns.map((col) => {
                        const isTs = isTimestampColumnName(col)
                        const tzLabel = tzMode === 'UTC' ? 'UTC' : 'UTC+8'
                        const headerText = isTs ? `${col} (${tzLabel})` : col
                        return (
                          <th key={col} className="px-3 py-1 text-left text-[var(--color-text-primary)] border-b border-[var(--color-border-light)]">{headerText}</th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-b border-[var(--color-border-light)]">
                        {r.map((cell, cidx) => (
                          <td key={cidx} className="px-3 py-1 text-[var(--color-text-primary)]">
                            {formatCellValue(cell, columns[cidx] || '', tzMode)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasTimestampColumn && (
                  <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    时间戳默认以 <span className="text-[var(--color-text-secondary)]">UTC</span> 显示。可切换查看 <span className="text-[var(--color-text-secondary)]">Asia/Shanghai(+8)</span>。
                    该设置仅影响显示，不影响数据的查询与存储。
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

SqlTerminal.displayName = 'SqlTerminal'

export default SqlTerminal
