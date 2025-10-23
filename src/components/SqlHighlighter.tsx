import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface SqlHighlighterProps {
  code: string
  className?: string
  showLineNumbers?: boolean
}

// 自定义暗色主题，优化 SQL 语法高亮的对比度和可读性
const customDarkTheme = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: 'transparent', // 使用透明背景，由父容器控制
    margin: 0,
    padding: '12px 16px',
    fontSize: '14px',
    lineHeight: '1.5',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    color: '#f8fafc', // 高对比度前景色 (slate-50)
    border: 'none',
    borderRadius: '0',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'transparent',
    color: '#f8fafc',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  // SQL 关键字 - 使用蓝色系，高对比度
  '.token.keyword': {
    color: '#7dd3fc', // sky-300 - 高对比度蓝色
    fontWeight: '600',
  },
  // 字符串 - 使用绿色系
  '.token.string': {
    color: '#86efac', // green-300
  },
  // 数字 - 使用橙色系
  '.token.number': {
    color: '#fdba74', // orange-300
  },
  // 操作符 - 使用紫色系
  '.token.operator': {
    color: '#c4b5fd', // violet-300
  },
  // 函数名 - 使用青色系
  '.token.function': {
    color: '#67e8f9', // cyan-300
  },
  // 注释 - 使用灰色系
  '.token.comment': {
    color: '#94a3b8', // slate-400
    fontStyle: 'italic',
  },
  // 标点符号
  '.token.punctuation': {
    color: '#cbd5e1', // slate-300
  },
  // 表名、列名等标识符
  '.token.class-name': {
    color: '#fbbf24', // amber-400
  },
  // 变量
  '.token.variable': {
    color: '#fb7185', // rose-400
  },
  // 布尔值
  '.token.boolean': {
    color: '#a78bfa', // violet-400
  },
}

export default function SqlHighlighter({ 
  code, 
  className = '', 
  showLineNumbers = false 
}: SqlHighlighterProps) {
  return (
    <div className={`sql-highlighter ${className}`}>
      <SyntaxHighlighter
        language="sql"
        style={customDarkTheme}
        showLineNumbers={showLineNumbers}
        customStyle={{
          background: 'transparent',
          margin: 0,
          padding: 0,
        }}
        codeTagProps={{
          style: {
            background: 'transparent',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

// 用于显示 SQL 代码片段的只读组件
export function SqlCodeBlock({ 
  code, 
  className = '',
  title
}: {
  code: string
  className?: string
  title?: string
}) {
  return (
    <div className={`rounded-lg border border-gray-700/50 bg-gray-900/60 overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700/50">
          <div className="text-xs text-gray-400 font-medium">{title}</div>
        </div>
      )}
      <div className="relative">
        <SqlHighlighter 
          code={code.trim()} 
          showLineNumbers={code.split('\n').length > 3}
        />
        {/* 复制按钮 */}
        <button
          onClick={() => navigator.clipboard.writeText(code.trim())}
          className="absolute top-2 right-2 p-1.5 rounded bg-gray-800/80 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 transition-colors"
          title="复制代码"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}