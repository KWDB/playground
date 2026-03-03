import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import React from 'react'

export const highlighterStyle: { [selector: string]: React.CSSProperties } = {
  ...(vs as unknown as { [selector: string]: React.CSSProperties }),
  'pre[class*="language-"]': {
    ...((vs as unknown as { [selector: string]: React.CSSProperties })['pre[class*="language-"]'] || {}),
    background: '#0b1020',
  },
  'code[class*="language-"]': {
    ...((vs as unknown as { [selector: string]: React.CSSProperties })['code[class*="language-"]'] || {}),
    textShadow: 'none',
  },
  '.token.comment,.token.prolog,.token.doctype,.token.cdata': {
    color: '#94a3b8',
  },
  '.token.punctuation': {
    color: '#e5e7eb',
  },
  '.token.property,.token.tag,.token.constant,.token.symbol,.token.deleted': {
    color: '#93c5fd',
  },
  '.token.boolean,.token.number': {
    color: '#fdba74',
  },
  '.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted': {
    color: '#86efac',
  },
  '.token.operator,.token.entity,.token.url': {
    color: '#fca5a5',
  },
  '.token.atrule,.token.attr-value,.token.keyword': {
    color: '#60a5fa',
  },
  '.token.function,.token.class-name': {
    color: '#f9a8d4',
  },
}
