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
    padding: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    color: '#f8fafc', // 高对比度前景色 (slate-50)
    border: 'none',
    borderRadius: '0',
    whiteSpace: 'pre-wrap',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'transparent',
    color: '#f8fafc',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  // SQL 关键字 - 使用蓝色系，高对比度
  '.token.keyword': {
    color: '#c084fc', // 统一与编辑器的紫色关键字
    fontWeight: '600',
  },
  // 字符串 - 使用绿色系
  '.token.string': {
    color: '#34d399',
  },
  // 数字 - 使用橙色系
  '.token.number': {
    color: '#fbbf24',
  },
  // 操作符 - 使用紫色系
  '.token.operator': {
    color: '#f472b6',
  },
  // 函数名 - 使用青色系
  '.token.function': {
    color: '#67e8f9', // cyan-300
  },
  // 注释 - 使用灰色系
  '.token.comment': {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // 标点符号
  '.token.punctuation': {
    color: '#94a3b8',
  },
  // 表名、列名等标识符
  '.token.class-name': {
    color: '#fbbf24', // amber-400
  },
  // 变量
  '.token.variable': {
    color: '#60a5fa',
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
          // 保留主题中的 padding 以与编辑器一致
        }}
        codeTagProps={{
          style: {
            background: 'transparent',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '14px',
            lineHeight: '1.6',
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