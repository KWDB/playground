import React, { useEffect, useState } from 'react'
import { Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// 环境检测摘要类型（与后端 /api/check 返回结构对齐）
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

interface EnvCheckButtonProps {
  onClick: () => void
}

// 小工具：安全提取错误信息（中文注释便于理解）
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export default function EnvCheckButton({ onClick }: EnvCheckButtonProps) {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载环境检查数据（显示缩略状态）
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await fetch('/api/check', { signal: controller.signal })
        if (!resp.ok) throw new Error('环境检测接口返回错误')
        const json: Summary = await resp.json()
        setData(json)
      } catch (e: unknown) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [])

  // 计算通过/总数、缩略信息
  const total = data?.items?.length ?? 0
  const passed = data?.items?.filter(i => i.ok).length ?? 0

  // 按钮配色：全部通过为绿色，其它为灰/红提示
  const allPassed = !!data?.ok
  const baseClasses = allPassed
    ? 'bg-green-600 hover:bg-green-700 text-white'
    : 'bg-gray-900 hover:bg-black text-white'

  // 响应式布局：在窄屏展示精简信息，宽屏展示详细缩略信息
  return (
    <button
      onClick={onClick}
      className={`w-full sm:w-auto inline-flex items-center gap-3 px-5 py-3 rounded-lg transition-all duration-200 shadow-sm ${baseClasses}`}
      aria-haspopup="dialog"
      aria-controls="env-check-modal"
    >
      {/* 左侧图标：加载中显示转圈，正常显示终端图标 */}
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : allPassed ? (
        <CheckCircle2 className="h-5 w-5" />
      ) : error ? (
        <AlertCircle className="h-5 w-5" />
      ) : (
        <Terminal className="h-5 w-5" />
      )}

      {/* 中间文案：标题 + 缩略信息，兼顾易读与压缩 */}
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium leading-none">环境检测</span>
        <span className="text-xs opacity-90 mt-1 hidden sm:inline">
          {loading && '检查中…'}
          {!loading && error && `失败：${error}`}
          {!loading && !error && (allPassed ? '所有项目通过' : '存在未通过项目')}
        </span>
      </div>

      {/* 右侧状态徽标：明确展示 3/3（通过/总数） */}
      <span
        className={`ml-auto sm:ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
          allPassed ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
        }`}
      >
        {passed}/{total}
      </span>
    </button>
  )
}