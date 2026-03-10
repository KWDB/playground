import { oneDark, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import React from 'react'

const buildHighlighterStyle = (base: { [selector: string]: React.CSSProperties }, isDark: boolean) => ({
  ...base,
  'pre[class*="language-"]': {
    ...(base['pre[class*="language-"]'] || {}),
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-light)',
  },
  'code[class*="language-"]': {
    ...(base['code[class*="language-"]'] || {}),
    textShadow: 'none',
    color: 'var(--color-text-primary)',
    background: 'transparent',
  },
  '.token.comment,.token.prolog,.token.doctype,.token.cdata': {
    color: isDark ? '#9caec7' : '#64748b',
  },
  '.token.punctuation': {
    color: isDark ? '#e2e8f0' : '#475569',
  },
  '.token.property,.token.tag,.token.constant,.token.symbol,.token.deleted': {
    color: isDark ? '#93c5fd' : '#1d4ed8',
  },
  '.token.boolean,.token.number': {
    color: isDark ? '#fbbf24' : '#b45309',
  },
  '.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted': {
    color: isDark ? '#86efac' : '#166534',
  },
  '.token.operator,.token.entity,.token.url': {
    color: isDark ? '#fda4af' : '#be123c',
  },
  '.token.atrule,.token.attr-value,.token.keyword': {
    color: isDark ? '#60a5fa' : '#1d4ed8',
  },
  '.token.function,.token.class-name': {
    color: isDark ? '#f9a8d4' : '#be185d',
  },
})

const lightBase = vs as unknown as { [selector: string]: React.CSSProperties }
const darkBase = oneDark as unknown as { [selector: string]: React.CSSProperties }

export const highlighterStyleLight: { [selector: string]: React.CSSProperties } = buildHighlighterStyle(lightBase, false)
export const highlighterStyleDark: { [selector: string]: React.CSSProperties } = buildHighlighterStyle(darkBase, true)
