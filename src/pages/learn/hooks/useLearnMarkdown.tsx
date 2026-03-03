import { useCallback } from 'react'
import React from 'react'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

export const useLearnMarkdown = (onExecClick: (event: React.MouseEvent) => void) => {
  return useCallback((content: string) => (
    <MarkdownRenderer content={content} onExecClick={onExecClick} />
  ), [onExecClick])
}
