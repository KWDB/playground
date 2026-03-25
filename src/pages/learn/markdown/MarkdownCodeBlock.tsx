import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useTheme } from '../../../hooks/useTheme'
import { extractTextFromNode, readNodeMeta } from '../utils/markdown'
import { highlighterStyleDark, highlighterStyleLight } from './highlighterStyle'

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  className?: string
  children?: React.ReactNode
  node?: unknown
}

export const MarkdownCodeBlock = ({ className, children, node, ...props }: CodeProps) => {
  const { isDark } = useTheme()
  const match = /language-([\w-]+)/.exec(className || '')
  const langToken = match ? match[1] : ''
  const codeText = extractTextFromNode(children ?? '').replace(/\n$/, '')
  const metaValue = readNodeMeta(node)
  const hasExecMeta = !!(metaValue && String(metaValue).includes('exec'))
  const hasExecInClass = langToken.includes('-exec')
  const language = langToken.replace(/-exec$/, '')
  const isExecutable = language === 'python' || language === 'bash' || language === 'java'

  if (!match) {
    return (
      <code className="markdown-inline-code" {...props}>
        {codeText}
      </code>
    )
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-header">
        <div className="flex items-center space-x-2">
          <div className="markdown-code-dots">
            <div className="markdown-code-dot markdown-code-dot--red"></div>
            <div className="markdown-code-dot markdown-code-dot--yellow"></div>
            <div className="markdown-code-dot markdown-code-dot--green"></div>
          </div>
          <span className="markdown-code-language">{language}</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="markdown-code-title">{(hasExecMeta || hasExecInClass || isExecutable) ? '可执行代码' : '代码块'}</div>
          {(hasExecMeta || hasExecInClass || isExecutable) && (
            <button
              className="exec-btn"
              data-command={language === 'python' ? `python3 - << 'PYTHON_EOF'\n${codeText}\nPYTHON_EOF` : codeText}
              data-language={language}
              title="执行命令"
            >
              Run
            </button>
          )}
        </div>
      </div>
      <div className="markdown-code-content">
        <SyntaxHighlighter
          style={isDark ? highlighterStyleDark : highlighterStyleLight}
          language={language}
          PreTag="pre"
          className="markdown-syntax-highlighter"
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
