import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

type CheckItem = {
  name: string
  ok: boolean
  message: string
  details?: string
}

type Summary = {
  ok: boolean
  items: CheckItem[]
}

function parseMirrorAvailabilityMessage(message: string): { available: string[]; unavailable: string[] } | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const availableMatch = trimmed.match(/可用：([^；]+)(?:；|$)/)
  const unavailableMatch = trimmed.match(/不可用：(.+)$/)
  if (!availableMatch && !unavailableMatch) return null

  const splitList = (value: string | undefined) => {
    if (!value) return []
    return value
      .split(/[，,]/g)
      .map(s => s.trim())
      .filter(Boolean)
  }

  return {
    available: splitList(availableMatch?.[1]),
    unavailable: splitList(unavailableMatch?.[1]),
  }
}

// 增加可选属性以支持弹窗模式：alwaysExpanded 在弹窗内始终展开
export default function EnvCheckPanel({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/check')
      if (!resp.ok) throw new Error('环境检测接口返回错误')
      const json: Summary = await resp.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '环境检测失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="w-full">
      {/* 可展开的内容区域 */}
      <div className={`transition-all duration-300 overflow-hidden ${
        alwaysExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200">
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="ml-2">
                <h4 className="text-sm font-medium text-red-800">检测失败</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 加载状态 - 改为列表样式 */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-md border border-gray-200">
                <div className="animate-pulse flex items-center space-x-3">
                  <div className="w-5 h-5 bg-gray-200 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                  </div>
                  <div className="w-16 h-6 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 检测结果 - 改为列表布局 */
          <div className="space-y-1">
            {data?.items.map((item, index) => (
              <div 
                key={item.name} 
                className={`bg-white p-4 rounded-md border transition-all hover:shadow-sm ${
                  item.ok 
                    ? 'border-gray-200 hover:border-green-300' 
                    : 'border-red-200 hover:border-red-300'
                } ${index !== 0 ? 'border-t-0 rounded-t-none' : ''} ${index !== data.items.length - 1 ? 'rounded-b-none' : ''}`}
              >
                <div className="flex items-center justify-between">
                  {/* 左侧：图标和内容 */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* 状态图标 */}
                    <div className={`flex-shrink-0 p-1 rounded ${
                      item.ok 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    
                    {/* 标题和描述 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </h4>
                      {(() => {
                        const isMirror = item.name === '镜像源可用性'
                        const parsed = isMirror ? parseMirrorAvailabilityMessage(item.message) : null
                        const hasBoth = !!parsed && (parsed.available.length > 0 || parsed.unavailable.length > 0)
                        const shouldSplit = !!parsed && parsed.unavailable.length > 0 && parsed.available.length > 0

                        if (!isMirror || !hasBoth || !shouldSplit) {
                          return (
                            <p className={`text-sm mt-1 ${item.ok ? 'text-gray-600' : 'text-red-700'}`}>
                              {item.message}
                            </p>
                          )
                        }

                        return (
                          <div className="mt-1 text-sm space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                可用
                              </span>
                              {parsed.available.map(label => (
                                <span
                                  key={`avail-${label}`}
                                  className="text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                不可用
                              </span>
                              {parsed.unavailable.map(label => (
                                <span
                                  key={`unavail-${label}`}
                                  className="text-xs text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  
                  {/* 右侧：状态标签 */}
                  <div className="flex-shrink-0 ml-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.ok 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.ok ? '通过' : '失败'}
                    </span>
                  </div>
                </div>
                
                {/* 详细信息 */}
                {item.details && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border">
                    <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono">
                      {item.details}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* 总体状态指示 - 简化并移到底部 */}
        {data && !loading && (
          <div className="mt-4 p-3 text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
              data.ok 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {data.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  所有检测项目通过
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  存在检测项目未通过
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
