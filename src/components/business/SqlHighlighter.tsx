import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface SqlHighlighterProps {
  code: string
  className?: string
  showLineNumbers?: boolean
}

const lightTheme = {
  ...vs,
  'pre[class*="language-"]': {
    ...vs['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: '12px',
    fontSize: '14px',
    lineHeight: '1.6',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: '0',
    whiteSpace: 'pre-wrap',
  },
  'code[class*="language-"]': {
    ...vs['code[class*="language-"]'],
    background: 'transparent',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  '.token.keyword': {
    color: '#7c3aed',
    fontWeight: '600',
  },
  '.token.string': {
    color: '#059669',
  },
  '.token.number': {
    color: '#d97706',
    fontWeight: '500',
  },
  '.token.operator': {
    color: '#dc2626',
    fontWeight: '500',
  },
  '.token.function': {
    color: 'var(--color-accent-primary)',
  },
  '.token.comment': {
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  '.token.punctuation': {
    color: 'var(--color-text-secondary)',
  },
  '.token.class-name': {
    color: '#d97706',
  },
  '.token.variable': {
    color: 'var(--color-accent-primary)',
  },
  '.token.boolean': {
    color: '#7c3aed',
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
        style={lightTheme}
        showLineNumbers={showLineNumbers}
        customStyle={{
          background: 'transparent',
          margin: 0,
        }}
        codeTagProps={{
          style: {
            background: 'transparent',
            fontFamily: 'var(--font-mono)',
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
    <div className={`rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-light)]">
          <div className="text-xs font-medium text-[var(--color-text-secondary)]">{title}</div>
        </div>
      )}
      <div className="relative">
        <SqlHighlighter
          code={code.trim()}
          showLineNumbers={code.split('\n').length > 3}
        />
        <button
          onClick={() => navigator.clipboard.writeText(code.trim())}
          className="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
