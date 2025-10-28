import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import EnhancedSqlEditor from './EnhancedSqlEditor'
import { fetchJson } from '@/lib/http'

type Props = {
  courseId: string
  port: number
  // 容器状态：用于控制自动连接与刷新逻辑
  // 约定：running/starting/stopped/exited 等
  containerStatus?: string
}

type SqlInfo = {
  version?: string
  port?: number
  connected?: boolean
}

// 执行结果类型
type ExecutionResult = {
  type: 'success' | 'query' | 'error'
  message?: string
  rowsAffected?: number
  columns?: string[]
  rows?: (string | number | boolean | null)[][]
}

// SQL 终端引用接口
export interface SqlTerminalRef {
  sendCommand: (command: string) => void
}

// SQL 语法高亮编辑器组件
// 时区模式类型
type TzMode = 'UTC' | 'LOCAL'

// 判断列名是否为时间戳列
const isTimestampColumnName = (name: string): boolean => /^(ts|.*time.*|.*timestamp.*)$/i.test(name)

// 左侧补零
const pad2 = (n: number) => String(n).padStart(2, '0')

// 按 UTC 输出 yyyy-MM-dd HH:mm:ss
const formatUtc = (date: Date): string => {
  const y = date.getUTCFullYear()
  const m = pad2(date.getUTCMonth() + 1)
  const d = pad2(date.getUTCDate())
  const hh = pad2(date.getUTCHours())
  const mm = pad2(date.getUTCMinutes())
  const ss = pad2(date.getUTCSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

// 按本地(+8)输出 yyyy-MM-dd HH:mm:ss（仅用于显示）
const formatLocalShanghai = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).replace(/\//g, '-').replace(/,/g, '')
}

// 解析可能包含或不包含时区的字符串为 Date（按 UTC 解释）
const parseTimestampAsUtc = (raw: string): Date | null => {
  // 带 Z 或偏移量的字符串，交给 Date 解析
  if (/Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  }
  // 纯 "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DDTHH:mm:ss" 按 UTC 解释
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?$/)
  if (m) {
    // 忽略完整匹配项，仅提取各时间字段，避免未使用变量告警
    const [, yy, MM, dd, hh, mm, ss] = m
    const ms = Date.UTC(
      Number(yy), Number(MM) - 1, Number(dd),
      Number(hh), Number(mm), Number(ss)
    )
    return new Date(ms)
  }
  // 其它格式尝试原生解析
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

// 格式化单元格数据（支持时区模式）
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
  // WebSocket 相关状态
  const [wsConnected, setWsConnected] = useState(false)
  const [queryText, setQueryText] = useState<string>('')
  const [columns, setColumns] = useState<string[]>([])
  type Cell = string | number | boolean | null
  const [rows, setRows] = useState<Cell[][]>([])
  const [executing, setExecuting] = useState(false)
  const [lastExecutionResult, setLastExecutionResult] = useState<ExecutionResult | null>(null)
  // 时区显示模式：默认 UTC
  const [tzMode, setTzMode] = useState<TzMode>('UTC')

  // 当前查询是否包含时间戳列（用于控制时区切换的显示）
  const hasTimestampColumn = useMemo(() => {
    return columns.some((c) => isTimestampColumnName(c))
  }, [columns])

  const wsRef = useRef<WebSocket | null>(null)
  const infoAbortControllerRef = useRef<AbortController | null>(null)

  // 拼接信息接口 URL
  const infoUrl = useMemo(() => `/api/sql/info?courseId=${encodeURIComponent(courseId)}`, [courseId])

  // 组装 WebSocket URL（根据当前协议决定 ws/wss）
  const wsUrl = useMemo(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws/sql`
  }, [])

  // 发送 SQL 命令到 textarea
  const sendCommand = useCallback((command: string) => {
    // 将接收到的 SQL 命令自动填充到 textarea 中
    setQueryText(command)
    // 清除之前的错误信息和执行结果，提供更好的用户体验
    setError(null)
    setLastExecutionResult(null)
    setColumns([])
    setRows([])

    // 自动执行 SQL 命令 - 实现无缝交互体验
    // 只有在 WebSocket 连接正常且未在执行其他命令时才自动执行
    if (wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      !executing &&
      command.trim()) {

      // 设置执行状态
      setExecuting(true)

      // 发送 SQL 命令到后端执行
      const qid = `q_${Date.now()}`
      const msg = { type: 'query', queryId: qid, sql: command }
      wsRef.current.send(JSON.stringify(msg))
    } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // WebSocket 未连接时显示错误提示
      setError('WS 未连接，无法执行命令')
    } else if (executing) {
      // 正在执行其他命令时显示提示
      setError('正在执行其他命令，请稍后再试')
    }
  }, [executing])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendCommand
  }), [sendCommand])

  // 加载连接信息
  const fetchInfo = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<SqlInfo>(infoUrl, { signal })
      setInfo(data)
    } catch (e) {
      const maybeAbort = e as { name?: string }
      if (maybeAbort?.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || '未知错误')
    } finally {
      setLoading(false)
    }
  }, [infoUrl])

  useEffect(() => {
    // 中止上一轮信息请求并启动新一轮
    infoAbortControllerRef.current?.abort()
    const controller = new AbortController()
    infoAbortControllerRef.current = controller
    fetchInfo(controller.signal)

    // 依赖变化或卸载时中止当前信息请求
    return () => {
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
    }
  }, [fetchInfo])

  // 通过 ref 持有最新的 fetchInfo，避免在 WebSocket 回调中闭包过期
  const fetchInfoRef = useRef<() => void>(() => { })
  useEffect(() => {
    fetchInfoRef.current = () => {
      // 中止上一轮信息请求，避免并发
      infoAbortControllerRef.current?.abort()
      const controller = new AbortController()
      infoAbortControllerRef.current = controller
      fetchInfo(controller.signal)
    }
  }, [fetchInfo])

  // 建立 WebSocket 连接
  // 根据容器状态建立或关闭 WebSocket
  useEffect(() => {
    // 容器未运行时关闭 WS 并退出
    if (containerStatus !== 'running') {
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* 忽略关闭异常 */ }
        wsRef.current = null
      }
      setWsConnected(false)
      // 终止当前信息请求并清理引用
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
      return
    }

    // 容器运行中且尚未建立 WS，则创建连接
    if (wsRef.current) return
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // 连接打开后发送 init
    ws.onopen = () => {
      setWsConnected(true)
      const initMsg = { type: 'init', courseId }
      ws.send(JSON.stringify(initMsg))
    }

    // 接收服务端消息
    ws.onmessage = (ev) => {
      try {
        type WsMessage = { type: string;[key: string]: unknown }
        const msg: WsMessage = JSON.parse(ev.data)

        if (msg.type === 'ready') {
          // SQL 通道就绪：主动刷新连接信息，无需用户点击"刷新"
          fetchInfoRef.current()
          return
        }

        if (msg.type === 'info') {
          // 更新连接信息面板，使状态即时反映
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
          // 基于后端响应数据判断操作类型，而不是解析 SQL 语句
          const columns = Array.isArray(msg.columns) ? msg.columns : []
          const rows = Array.isArray(msg.rows) ? msg.rows : []
          const rowCount = typeof msg.rowCount === 'number' ? msg.rowCount : 0

          // 判断操作类型
          const hasColumns = columns.length > 0
          const hasRows = rows.length > 0

          if (hasColumns) {
            // 查询操作（SELECT）- 有列定义，显示结果表格
            setColumns(columns)
            setRows(rows)
            setLastExecutionResult({
              type: 'query',
              columns,
              rows,
              message: `查询完成，返回 ${hasRows ? rows.length : 0} 行数据`
            })
          } else {
            // 非查询操作 - 无列定义，显示成功消息
            setColumns([])
            setRows([])

            let successMessage = ''

            if (rowCount > 0) {
              // 数据操作（INSERT/UPDATE/DELETE）- 影响了行数
              successMessage = `操作成功，影响 ${rowCount} 行数据`
            } else {
              // 结构操作（CREATE/DROP/ALTER）- 未影响数据行
              successMessage = '操作成功'
            }

            setLastExecutionResult({
              type: 'success',
              message: successMessage,
              rowsAffected: rowCount
            })
          }

          // 设置执行完成状态
          setExecuting(false)
          return
        }

        // 处理成功消息（用于建表、插入等操作）
        if (msg.type === 'success') {
          setExecuting(false)
          const rowsAffected = typeof msg.rowsAffected === 'number' ? msg.rowsAffected : undefined
          const message = typeof msg.message === 'string' ? msg.message : '操作成功'

          // 清除查询结果表格（因为这不是查询操作）
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
          // 运行时类型收敛，避免 unknown 直接赋值导致 TS 报错
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

  // 未连接时自动重试：周期性发送 init 并刷新连接信息
  // 设计意图：容器刚启动到数据库就绪有短暂窗口，避免用户手动点击"刷新"
  useEffect(() => {
    // 仅在容器运行且未连接时进行自动重试
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

  // 组件卸载时中止可能仍在进行的信息请求
  useEffect(() => {
    return () => {
      infoAbortControllerRef.current?.abort()
      infoAbortControllerRef.current = null
    }
  }, [])

  // 发送查询
  const runQuery = () => {
    // 清除之前的结果和错误信息
    setError(null)
    setLastExecutionResult(null)
    setColumns([])
    setRows([])

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WS 未连接，无法执行')
      return
    }

    // 设置执行状态
    setExecuting(true)

    const qid = `q_${Date.now()}`
    const msg = { type: 'query', queryId: qid, sql: queryText }
    wsRef.current.send(JSON.stringify(msg))
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#0d1117' }}>
      {/* 顶部状态与操作栏 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50" style={{ backgroundColor: '#161b22' }}>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">SQL</span>
          <span className="text-gray-300">端口: {port}</span>
        </div>
        <button
          onClick={() => fetchInfoRef.current()}
          className="px-3 py-1.5 text-sm rounded bg-gray-800/60 text-gray-200 hover:bg-gray-700/80 border border-gray-600/50"
        >刷新</button>
      </div>

      {/* 连接信息面板 */}
      <div className="p-4 space-y-3 text-gray-200 overflow-auto">
        {loading && containerStatus === 'running' && <div className="text-gray-400 text-sm">正在加载连接信息...</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!loading && !error && containerStatus === 'running' && (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded border border-gray-700/50 bg-gray-900/50 p-3">
              <div className="text-xs text-gray-400 mb-1">KWDB 版本</div>
              <div className="text-sm">{info?.version || '未知'}</div>
            </div>
          </div>
        )}

        {/* 容器未运行时的提示信息 */}
        {containerStatus !== 'running' && (
          <div className="flex items-center justify-center h-full text-gray-500">
            请启动容器以连接终端
          </div>
        )}

        {/* 执行区 */}
        {containerStatus === 'running' && (
          <div className="rounded border border-gray-700/50 bg-gray-900/40 p-3 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">执行区</div>
              <div className={`text-xs ${wsConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>{wsConnected ? 'WS 已连接' : 'WS 未连接'}</div>
            </div>
            {/* SQL 编辑器（增强版，支持语法高亮） */}
            <EnhancedSqlEditor
              value={queryText}
              onChange={setQueryText}
              placeholder="输入 SQL，按下方按钮执行"
              className="w-full bg-gray-800/60"
              disabled={executing}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={runQuery}
                disabled={executing || !wsConnected}
                className={`px-3 py-1.5 text-sm rounded ${executing || !wsConnected
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {executing ? '执行中...' : '执行'}
              </button>
            </div>

            {/* 执行结果反馈 */}
            {lastExecutionResult && (
              <div className="mt-3">
                {lastExecutionResult.type === 'success' && (
                  <div className="rounded border border-emerald-600/40 bg-emerald-900/20 p-3">
                    <div className="text-sm text-emerald-300">
                      {lastExecutionResult.message}
                    </div>
                  </div>
                )}

                {lastExecutionResult.type === 'error' && (
                  <div className="rounded border border-red-600/40 bg-red-900/20 p-3">
                    <div className="text-sm text-red-300">{lastExecutionResult.message}</div>
                  </div>
                )}
              </div>
            )}

            {/* 结果表格（仅查询操作显示） */}
            {columns.length > 0 && (
              <div className="mt-3 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">查询结果</div>
                  {hasTimestampColumn && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">时区</span>
                      <div className="inline-flex rounded border border-gray-700 overflow-hidden">
                        <button
                          className={`px-2 py-1 text-xs ${tzMode === 'UTC' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                          onClick={() => setTzMode('UTC')}
                          aria-pressed={tzMode === 'UTC'}
                        >UTC</button>
                        <button
                          className={`px-2 py-1 text-xs ${tzMode === 'LOCAL' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
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
                          <th key={col} className="px-3 py-1 text-left text-gray-300 border-b border-gray-700/50">{headerText}</th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-800/50">
                        {r.map((cell, cidx) => (
                          <td key={cidx} className="px-3 py-1 text-gray-200">
                            {formatCellValue(cell, columns[cidx] || '', tzMode)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasTimestampColumn && (
                  <div className="mt-2 text-xs text-gray-400">
                    时间戳默认以 <span className="text-gray-200">UTC</span> 显示。可切换查看 <span className="text-gray-200">Asia/Shanghai(+8)</span>。
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

// 设置组件显示名称，便于调试
SqlTerminal.displayName = 'SqlTerminal'

export default SqlTerminal