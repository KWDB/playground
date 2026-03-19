import { describe, expect, it } from 'vitest'
import React from 'react'
import { extractTextFromNode, preprocessMarkdown, readNodeMeta } from './markdown'

describe('learn markdown utils', () => {
  it('injects exec marker for fenced block syntax', () => {
    const input = '```bash\necho 1\n```\n{{exec}}'
    const output = preprocessMarkdown(input)
    expect(output).toContain('```bash-exec')
  })

  it('injects inline run button for inline code exec', () => {
    const input = '`echo "hello"` {{exec}}'
    const output = preprocessMarkdown(input)
    expect(output).toContain('class="exec-btn"')
    expect(output).toContain('data-command-enc=')
  })

  it('injects inline copy button for inline code copy', () => {
    const input = '`http://localhost:3000` {{copy}}'
    const output = preprocessMarkdown(input)
    expect(output).toContain('class="copy-btn"')
    expect(output).toContain('data-copy-enc=')
    expect(output).toContain('inline-code-copy')
  })

  it('injects target blank anchor for markdown target syntax', () => {
    const input = '[http://localhost:3000](http://localhost:3000){:target="_blank"}'
    const output = preprocessMarkdown(input)
    expect(output).toContain('target="_blank"')
    expect(output).toContain('rel="noopener noreferrer"')
    expect(output).toContain('<a href="http://localhost:3000"')
  })

  it('replaces LOCAL_PORT placeholder with selected port', () => {
    const input = '访问地址: http://localhost:{{LOCAL_PORT}}'
    const output = preprocessMarkdown(input, { localPort: '3001' })
    expect(output).toContain('http://localhost:3001')
  })

  it('reads meta from node and node.data', () => {
    expect(readNodeMeta({ meta: 'exec' })).toBe('exec')
    expect(readNodeMeta({ data: { meta: 'exec2' } })).toBe('exec2')
    expect(readNodeMeta({})).toBeNull()
  })

  it('extracts text from string array and react element', () => {
    expect(extractTextFromNode('abc')).toBe('abc')
    expect(extractTextFromNode(['a', 'b'])).toBe('ab')
    expect(extractTextFromNode(React.createElement('span', null, 'k1'))).toBe('k1')
  })
})
