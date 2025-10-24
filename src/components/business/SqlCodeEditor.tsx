import React, { useEffect, useRef } from 'react'
import { EditorView, placeholder as cmPlaceholder, showTooltip, tooltips } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { lintGutter } from '@codemirror/lint'
import { ensureContrast, suggestMuted, suggestAccent, setCssVars } from '@/lib/contrast'

// 美化版 SQL 编辑器（CodeMirror 6）
// 目标：提供现代化、美观的 SQL 编辑体验
// 功能：增强语法高亮、优雅交互、美观界面、智能补全
export default function SqlCodeEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  onFocus,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  onFocus?: () => void
  onBlur?: () => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // 使用 Compartment 管理可编辑配置，便于运行时切换
  const editableCompartment = useRef(new Compartment())
  // 新增：使用 Compartment 管理签名提示的 tooltip 扩展
  const signatureCompartment = useRef(new Compartment())

  // 美化主题样式：现代深色风格，优雅交互体验
  const enhancedDarkTheme = EditorView.theme({
    // 根元素样式 - 增强视觉效果，移除默认边框
    '&': { 
      backgroundColor: 'var(--cm-bg)', 
      color: 'var(--cm-foreground)', 
      height: 'auto',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      // 移除 CodeMirror 默认边框和轮廓
      border: 'none !important',
      outline: 'none !important',
    },
    
    // 焦点状态增强 - 确保只有容器边框
    '&.cm-focused': {
      outline: 'none !important',
      border: 'none !important',
      // 移除 CodeMirror 内部的焦点样式，只保留容器的焦点效果
    },

    // 编辑器容器样式 - 移除内部边框
    '.cm-editor': {
      outline: 'none !important',
      border: 'none !important',
    },

    // 内容区域样式优化
    '.cm-content': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      color: 'var(--cm-foreground)',
      padding: '16px',
      caretColor: 'var(--cm-accent)',
      outline: 'none !important',
      border: 'none !important',
    },

    // 行样式优化
    '.cm-line': { 
      padding: '2px 0',
      position: 'relative',
    },

    // 滚动容器美化
    '.cm-scroller': { 
      overflow: 'auto', 
      maxHeight: '12rem', 
      minHeight: '6rem',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--cm-scrollbar) transparent',
    },

    // Webkit 滚动条美化
    '.cm-scroller::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: 'var(--cm-scrollbar)',
      borderRadius: '3px',
      transition: 'background 0.2s ease',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      background: 'var(--cm-scrollbar-hover)',
    },

    // 行号区域美化
    '.cm-gutters': {
      backgroundColor: 'var(--cm-gutter-bg)',
      border: 'none',
      color: 'var(--cm-gutter-text)',
      borderRadius: '12px 0 0 12px',
      paddingRight: '8px',
    },

    // 选择背景增强
    '.cm-selectionBackground': { 
      backgroundColor: 'var(--cm-selection)',
      borderRadius: '3px',
    },

    // 光标美化 - 更粗更明显
    '.cm-cursor': { 
      borderLeftColor: 'var(--cm-accent)',
      borderLeftWidth: '3px',
      borderRadius: '1px',
      animation: 'cm-cursor-pulse 1.5s infinite',
      boxShadow: '0 0 8px var(--cm-accent-glow)',
    },

    // 占位符样式
    '.cm-placeholder': { 
      color: 'var(--cm-placeholder)',
      fontStyle: 'italic',
      opacity: 0.7,
    },

    // 语法高亮增强
    '.cm-keyword': { 
      color: 'var(--cm-keyword)', 
      fontWeight: '600',
      textShadow: '0 0 4px var(--cm-keyword-glow)',
    },
    '.cm-string': { 
      color: 'var(--cm-string)',
      fontStyle: 'italic',
    },
    '.cm-number': { 
      color: 'var(--cm-number)',
      fontWeight: '500',
    },
    '.cm-comment': { 
      color: 'var(--cm-comment)',
      fontStyle: 'italic',
      opacity: 0.8,
    },
    '.cm-operator': { 
      color: 'var(--cm-operator)',
      fontWeight: '500',
    },
    '.cm-punctuation': { 
      color: 'var(--cm-punctuation)',
    },
    '.cm-variableName': { 
      color: 'var(--cm-variable)',
    },

    // 工具提示美化 - 大幅提升 z-index 确保显示在最顶层
    '.cm-tooltip': {
      backgroundColor: 'var(--cm-tooltip-bg)',
      border: '1px solid var(--cm-tooltip-border)',
      borderRadius: '12px',
      boxShadow: 'var(--cm-tooltip-shadow)',
      animation: 'cm-tooltip-enter 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(8px)',
      overflow: 'hidden',
      // 大幅提升 z-index 确保不被任何元素遮挡
      zIndex: '9999 !important', // 使用最大安全整数值
      position: 'fixed !important',
      // 确保工具提示不受父容器的 transform 影响
      transform: 'translateZ(0)',
      willChange: 'transform',
    },

    // 自动补全工具提示特殊处理 - 最高优先级显示
    '.cm-tooltip-autocomplete': { 
      overflow: 'hidden',
      zIndex: '2147483647 !important', // 最高层级
      position: 'fixed !important',
      // 确保不被父容器的 overflow 或 transform 影响
      transform: 'translateZ(0)',
      willChange: 'transform',
      // 强制脱离文档流，避免被任何容器限制
      contain: 'layout style paint',
      // 确保在所有浏览器中都能正确显示
      isolation: 'isolate',
    },

    // 签名提示也需要最高 z-index
    '.cm-tooltip-signature': {
      backgroundColor: 'var(--cm-tooltip-bg)',
      color: 'var(--cm-foreground)',
      border: '1px solid var(--cm-tooltip-border)',
      borderRadius: '10px',
      padding: '8px 12px',
      fontSize: '13px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      boxShadow: 'var(--cm-tooltip-shadow)',
      backdropFilter: 'blur(8px)',
      lineHeight: '1.4',
      zIndex: '2147483647 !important', // 最高层级
      position: 'fixed !important',
      transform: 'translateZ(0)',
      willChange: 'transform',
      contain: 'layout style paint',
      isolation: 'isolate',
    },

    // 动画定义
    '@keyframes cm-tooltip-enter': {
      '0%': { 
        opacity: 0, 
        transform: 'translateY(-8px) scale(0.95)',
      },
      '100%': { 
        opacity: 1, 
        transform: 'translateY(0) scale(1)',
      },
    },

    '@keyframes cm-cursor-pulse': {
      '0%, 50%': { 
        opacity: 1,
        transform: 'scaleY(1)',
      },
      '51%, 100%': { 
        opacity: 0.3,
        transform: 'scaleY(0.8)',
      },
    },

    // 工具提示间距优化
    '.cm-tooltip.cm-tooltip-above': { marginBottom: '12px' },
    '.cm-tooltip.cm-tooltip-below': { marginTop: '12px' },
    '.cm-tooltip.cm-tooltip-autocomplete': { overflow: 'hidden' },

    // 补全列表美化
    '.cm-tooltip-autocomplete .cm-completionList': {
      padding: '8px',
      margin: 0,
      maxHeight: '280px',
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--cm-scrollbar) transparent',
    },

    // 补全项美化
    '.cm-completionItem': {
      padding: '10px 12px',
      borderRadius: '8px',
      margin: '2px 0',
      color: 'var(--cm-foreground)',
      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
    },

    '.cm-completionItem::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(90deg, transparent, var(--cm-accent-subtle), transparent)',
      opacity: 0,
      transition: 'opacity 0.3s ease',
    },

    '.cm-completionItem:hover': {
      backgroundColor: 'var(--cm-list-hover-bg)',
      transform: 'translateX(4px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },

    '.cm-completionItem:hover::before': {
      opacity: 1,
    },

    '.cm-completionSelected': {
      backgroundColor: 'var(--cm-list-selected-bg)',
      boxShadow: 'inset 0 0 0 2px var(--cm-accent), 0 4px 12px rgba(0, 0, 0, 0.2)',
      transform: 'translateX(6px)',
    },

    // 补全标签美化
    '.cm-completionLabel': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      letterSpacing: '0.3px',
      fontWeight: '500',
    },

    '.cm-completionDetail': { 
      color: 'var(--cm-muted)',
      fontSize: '12px',
      marginLeft: '8px',
    },

    '.cm-completionMatchedText': { 
      color: 'var(--cm-accent)', 
      textDecoration: 'none',
      fontWeight: '600',
      background: 'var(--cm-accent-bg)',
      padding: '1px 2px',
      borderRadius: '2px',
    },

    // 补全图标美化
    '.cm-completionIcon': { 
      width: '16px', 
      height: '16px', 
      marginRight: '10px', 
      opacity: 0.9,
      borderRadius: '3px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: 'bold',
    },

    '.cm-completionIcon-keyword': { 
      color: '#ffffff',
      backgroundColor: '#8b5cf6',
      boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)',
    },
    '.cm-completionIcon-function': { 
      color: '#ffffff',
      backgroundColor: 'var(--cm-accent)',
      boxShadow: '0 2px 4px var(--cm-accent-shadow)',
    },
    '.cm-completionIcon-variable': { 
      color: '#ffffff',
      backgroundColor: '#f97316',
      boxShadow: '0 2px 4px rgba(249, 115, 22, 0.3)',
    },
    '.cm-completionIcon-property': { 
      color: '#ffffff',
      backgroundColor: '#06b6d4',
      boxShadow: '0 2px 4px rgba(6, 182, 212, 0.3)',
    },

    // 签名提示美化（已在上面定义，包含 z-index）
  })

  // 添加全局样式，确保顶级工具提示正确显示
  useEffect(() => {
    // 创建全局样式，确保顶级工具提示能够正确显示
    const globalStyle = document.createElement('style')
    globalStyle.textContent = `
      /* 顶级补全工具提示样式 - 确保在最高层级显示 */
      .cm-tooltip-autocomplete-top-level {
        z-index: 2147483647 !important;
        position: fixed !important;
        background: rgba(15, 23, 42, 0.95) !important;
        border: 1px solid rgba(59, 130, 246, 0.3) !important;
        border-radius: 12px !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2) !important;
        backdrop-filter: blur(8px) !important;
        overflow: hidden !important;
        transform: translateZ(0) !important;
        will-change: transform !important;
        contain: layout style paint !important;
        isolation: isolate !important;
        /* 确保不被任何父容器的样式影响 */
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
      }
      
      /* 确保补全列表在顶级工具提示中正确显示 */
      .cm-tooltip-autocomplete-top-level .cm-completionList {
        padding: 8px !important;
        margin: 0 !important;
        max-height: 280px !important;
        overflow: auto !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(148, 163, 184, 0.3) transparent !important;
      }
      
      /* 确保补全项在顶级工具提示中正确显示 */
      .cm-tooltip-autocomplete-top-level .cm-completionItem {
        padding: 10px 12px !important;
        border-radius: 8px !important;
        margin: 2px 0 !important;
        color: #f8fafc !important;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        cursor: pointer !important;
        position: relative !important;
        overflow: hidden !important;
      }
      
      .cm-tooltip-autocomplete-top-level .cm-completionItem:hover {
        background-color: rgba(59, 130, 246, 0.08) !important;
        transform: translateX(4px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      }
      
      .cm-tooltip-autocomplete-top-level .cm-completionSelected {
        background-color: rgba(59, 130, 246, 0.15) !important;
        box-shadow: inset 0 0 0 2px #3b82f6, 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        transform: translateX(6px) !important;
      }
    `
    document.head.appendChild(globalStyle)
    
    return () => {
      // 清理全局样式
      if (document.head.contains(globalStyle)) {
        document.head.removeChild(globalStyle)
      }
    }
  }, [])

  // 初始化编辑器实例
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

    // 编辑器扩展集合
    const extensions = [
      sql(), // SQL 语法高亮
      EditorView.lineWrapping, // 启用自动换行，避免水平溢出
      // 自定义补全配置，确保工具提示渲染到正确位置
      autocompletion({ 
        override: [sqlCompletionSource],
        // 确保补全弹出框渲染到 body，避免被容器遮挡
        tooltipClass: () => 'cm-tooltip-autocomplete-top-level',
      }), 
      // 自定义工具提示配置，确保渲染到 body
      tooltips({
        parent: document.body, // 强制渲染到 body 元素
        position: 'fixed', // 使用固定定位
      }), 
      // 初始关闭签名提示（null），后续通过 Compartment 动态切换
      signatureCompartment.current.of(showTooltip.of(null)),
      lintGutter(), // 预留诊断栏位（后续接入本地/远端校验）
      enhancedDarkTheme,
      cmPlaceholder(placeholder || ''),
      // 通过 Compartment 注入可编辑配置，初始根据 disabled 状态决定
      editableCompartment.current.of(EditorView.editable.of(!disabled)),
      EditorView.updateListener.of((update) => {
        const view = update.view
        if (update.docChanged) {
          const doc = update.state.doc.toString()
          // 避免无谓回写导致的循环
          if (doc !== value) onChange(doc)
        }
        // 在文档变化或光标移动时更新签名提示
        if (update.docChanged || update.selectionSet) {
          const tip = createSignatureTooltip(update.state)
          view.dispatch({ effects: signatureCompartment.current.reconfigure(showTooltip.of(tip)) })
        }
        // 处理焦点事件
        if (update.focusChanged) {
          if (view.hasFocus) {
            onFocus?.()
          } else {
            onBlur?.()
          }
        }
      }),
    ]

    viewRef.current = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: hostRef.current,
    })

    return () => {
      // 卸载编辑器实例
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部 value 变化时同步到编辑器（保持受控）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  // 处理禁用态（editable 扩展切换）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: editableCompartment.current.reconfigure(EditorView.editable.of(!disabled)),
    })
  }, [disabled])

  // 动态检测容器背景并设置美化的高对比变量
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const bg = getComputedStyle(host).backgroundColor || '#0f172a'
    const currentFg = getComputedStyle(host).getPropertyValue('--cm-foreground').trim() || '#f8fafc'
    const newFg = ensureContrast(bg, currentFg, 'AAA', 14, 400)
    const newMuted = suggestMuted(bg)
    const newAccent = suggestAccent(bg)
    
    setCssVars(host, {
      // 基础颜色
      '--cm-bg': bg,
      '--cm-foreground': newFg,
      '--cm-muted': newMuted,
      '--cm-accent': newAccent,
      
      // 发光效果
      '--cm-accent-glow': `${newAccent}40`,
      '--cm-accent-subtle': `${newAccent}20`,
      '--cm-accent-bg': `${newAccent}15`,
      '--cm-accent-shadow': `${newAccent}30`,
      
      // 语法高亮颜色
      '--cm-keyword': '#c084fc',
      '--cm-keyword-glow': '#c084fc40',
      '--cm-string': '#34d399',
      '--cm-number': '#fbbf24',
      '--cm-comment': '#6b7280',
      '--cm-operator': '#f472b6',
      '--cm-punctuation': '#94a3b8',
      '--cm-variable': '#60a5fa',
      '--cm-placeholder': newMuted,
      
      // UI 元素
      '--cm-selection': 'rgba(59, 130, 246, 0.25)',
      '--cm-gutter-bg': 'rgba(15, 23, 42, 0.6)',
      '--cm-gutter-text': newMuted,
      
      // 滚动条
      '--cm-scrollbar': 'rgba(148, 163, 184, 0.3)',
      '--cm-scrollbar-hover': 'rgba(148, 163, 184, 0.5)',
      
      // 工具提示
      '--cm-tooltip-bg': 'rgba(15, 23, 42, 0.95)',
      '--cm-tooltip-border': 'rgba(59, 130, 246, 0.3)',
      '--cm-tooltip-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
      
      // 补全列表
      '--cm-list-hover-bg': 'rgba(59, 130, 246, 0.08)',
      '--cm-list-selected-bg': 'rgba(59, 130, 246, 0.15)',
    })
  }, [])

  return (
    <div
      ref={hostRef}
      className={`
        relative w-full 
        bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/80
        backdrop-blur-sm
        rounded-xl 
        border border-slate-700/50 
        shadow-xl shadow-black/20
        transition-all duration-300 ease-out
        hover:shadow-2xl hover:shadow-black/30
        hover:border-slate-600/60
        focus-within:border-blue-500/70
        focus-within:shadow-2xl 
        focus-within:shadow-blue-500/25
        focus-within:transform
        focus-within:scale-[1.01]
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}
        ${className || ''}
      `}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 50%, rgba(15, 23, 42, 0.9) 100%)',
        // 移除可能影响工具提示层级的属性
        // zIndex: 'auto', // 移除这个属性
        // isolation: 'isolate', // 移除这个属性，避免创建新的层叠上下文
        // 确保容器不会限制子元素的层级
        position: 'relative',
        // 不使用 transform，避免创建新的层叠上下文
      }}
    />
  )
}

// 简单版 schema 缓存与函数签名映射
const KEYWORDS = [
  'SELECT','FROM','WHERE','GROUP BY','ORDER BY','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN',
  'INSERT INTO','UPDATE','DELETE FROM','CREATE TABLE','PRIMARY KEY','NOT NULL','NULL','AND','OR','AS','ON',
  'LIMIT','OFFSET','VALUES','SET','TAGS','PRIMARY TAGS'
]

const SCHEMA = {
  tables: ['sensor_data.readings', 'devices', 'locations'],
  columns: {
    'sensor_data.readings': ['ts','temperature','humidity','device_id','location'],
    devices: ['device_id','device_name'],
    locations: ['location','country','city']
  }
} as const

const FUNCTIONS: Record<string, { label: string; params: string[]; detail?: string }> = {
  COUNT: { label: 'COUNT(expr)', params: ['expr'], detail: 'Aggregate count' },
  AVG: { label: 'AVG(expr)', params: ['expr'], detail: 'Average value' },
  SUM: { label: 'SUM(expr)', params: ['expr'], detail: 'Sum of values' },
  MIN: { label: 'MIN(expr)', params: ['expr'], detail: 'Minimum value' },
  MAX: { label: 'MAX(expr)', params: ['expr'], detail: 'Maximum value' },
  NOW: { label: 'NOW()', params: [], detail: 'Current timestamp' },
  CURRENT_DATE: { label: 'CURRENT_DATE()', params: [], detail: 'Current date' },
  ROUND: { label: 'ROUND(number, decimals)', params: ['number','decimals'], detail: 'Round number' },
  SUBSTRING: { label: 'SUBSTRING(string, from, length)', params: ['string','from','length'], detail: 'Substring' },
}

function tableItems() {
  return SCHEMA.tables.map((t) => ({ label: t, type: 'variable', boost: 90 }))
}

function columnItems(table?: string) {
  const cols = table && SCHEMA.columns[table as keyof typeof SCHEMA.columns]
  const all = cols ?? Object.values(SCHEMA.columns).flat()
  return all.map((c) => ({ label: c, type: 'property', boost: 80 }))
}

function keywordItems() {
  return KEYWORDS.map((k) => ({ label: k, type: 'keyword', boost: 70 }))
}

function functionItems() {
  return Object.keys(FUNCTIONS).map((name) => ({
    label: name,
    type: 'function',
    boost: 95,
    apply(view: EditorView, _completion: Completion, from: number, to: number) {
      view.dispatch({
        changes: { from, to, insert: `${name}()` },
        selection: { anchor: from + name.length + 1 },
      })
      return true
    },
    detail: FUNCTIONS[name].label,
    info: FUNCTIONS[name].detail || FUNCTIONS[name].label,
  }))
}

function resolveTableAlias(state: EditorState, aliasOrTable: string): string | null {
  const lower = state.doc.toString().toLowerCase()
  const alias = aliasOrTable.toLowerCase()
  // 直接命中为已知表
  if (SCHEMA.tables.some((t) => t.toLowerCase() === alias)) return aliasOrTable
  // 尝试匹配 FROM/JOIN 语句中的别名
  const patterns = [
    new RegExp(`from\\s+([a-z0-9_.]+)\\s+as\\s+${alias}`),
    new RegExp(`from\\s+([a-z0-9_.]+)\\s+${alias}`),
    new RegExp(`join\\s+([a-z0-9_.]+)\\s+as\\s+${alias}`),
    new RegExp(`join\\s+([a-z0-9_.]+)\\s+${alias}`),
  ]
  for (const re of patterns) {
    const m = lower.match(re)
    if (m && m[1]) return m[1]
  }
  return null
}

function sqlCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/[\w.]*$/)
  if (!word) return null
  if (word.from === word.to && !context.explicit) return null

  const fromForDot = word.text.includes('.') ? word.from + word.text.indexOf('.') + 1 : word.from
  const before = context.state.sliceDoc(Math.max(0, word.from - 200), word.from).toUpperCase()

  // 使用语法树获取当前位置的粗略节点类型（未来可进一步细化）
  const node = syntaxTree(context.state).resolveInner(context.pos, -1)
  const nodeName = node.name
  // 根据上下文判断候选类型
  if (/\b(FROM|JOIN|UPDATE|INTO|TABLE|DELETE\s+FROM)\s+$/.test(before)) {
    return { from: word.from, options: tableItems() }
  }

  if (word.text.includes('.')) {
    const [maybeAlias] = word.text.split('.')
    const table = resolveTableAlias(context.state, maybeAlias) || maybeAlias
    return { from: fromForDot, options: columnItems(table) }
  }

  // 在 SELECT/WHERE 等位置优先提供列与函数
  if (/\b(SELECT|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|SET)\b[\s\w,()]*$/.test(before) || nodeName === 'Identifier') {
    return { from: word.from, options: [...columnItems(), ...functionItems(), ...keywordItems()] }
  }

  // 默认提供关键字与函数
  return { from: word.from, options: [...keywordItems(), ...functionItems(), ...columnItems()] }
}

function findSignatureInfo(state: EditorState) {
  const pos = state.selection.main.head
  const doc = state.doc
  // 寻找最近的“(”并计算是否在函数调用的最外层括号内
  let start = -1
  let depth = 0
  for (let i = pos - 1; i >= 0; i--) {
    const ch = doc.sliceString(i, i + 1)
    if (ch === ')') depth++
    else if (ch === '(') {
      if (depth === 0) { start = i; break }
      else depth--
    }
  }
  if (start < 0) return null
  // 取函数名
  let j = start - 1
  while (j >= 0 && /\s/.test(doc.sliceString(j, j + 1))) j--
  const endWord = j
  while (j >= 0 && /[A-Za-z0-9_]/.test(doc.sliceString(j, j + 1))) j--
  const name = doc.sliceString(j + 1, endWord + 1)
  const meta = FUNCTIONS[name.toUpperCase()]
  if (!meta) return null
  // 计算参数索引（忽略嵌套括号）
  let idx = 0
  depth = 0
  for (let k = start + 1; k < pos; k++) {
    const c = doc.sliceString(k, k + 1)
    if (c === '(') depth++
    else if (c === ')') { if (depth > 0) depth-- } 
    else if (c === ',' && depth === 0) idx++
  }
  return { name, params: meta.params, index: Math.min(idx, Math.max(0, meta.params.length - 1)) }
}

function createSignatureTooltip(state: EditorState) {
  const info = findSignatureInfo(state)
  if (!info) return null
  const pos = state.selection.main.head
  return {
    pos,
    above: true,
    strictSide: true,
    create: () => {
      const dom = document.createElement('div')
      dom.className = 'cm-tooltip cm-tooltip-signature'
      const fn = document.createElement('span')
      fn.textContent = info.name + '('
      dom.appendChild(fn)
      info.params.forEach((p, i) => {
        const span = document.createElement('span')
        span.textContent = p + (i < info.params.length - 1 ? ', ' : '')
        if (i === info.index) span.style.color = '#7dd3fc' // 高亮当前参数
        dom.appendChild(span)
      })
      const end = document.createElement('span')
      end.textContent = ')'
      dom.appendChild(end)
      return { dom }
    }
  }
}