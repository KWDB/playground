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
