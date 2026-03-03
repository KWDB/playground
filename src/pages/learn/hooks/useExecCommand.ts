import { useCallback } from 'react'
import React from 'react'
import { SqlTerminalRef } from '../../../components/business/SqlTerminal'
import { TerminalRef } from '../../../components/business/Terminal'
import { CodeTerminalRef } from '../../../components/business/CodeTerminal'
import { Course } from '../../../store/learnStore'

type Params = {
  course: Course | null
  containerId: string | null
  containerStatus: string
  sqlTerminalRef: React.RefObject<SqlTerminalRef>
  terminalRef: React.RefObject<TerminalRef>
  codeTerminalRef: React.RefObject<CodeTerminalRef>
}

export const useExecCommand = ({
  course,
  containerId,
  containerStatus,
  sqlTerminalRef,
  terminalRef,
  codeTerminalRef,
}: Params) => {
  return useCallback((e: React.MouseEvent) => {
    const button = (e.target as HTMLElement).closest('.exec-btn') as HTMLElement
    if (!button) return

    let command = button.getAttribute('data-command')
    const encoded = button.getAttribute('data-command-enc')
    if (!command && encoded) {
      try {
        command = decodeURIComponent(encoded)
      } catch {
        command = encoded
      }
    }

    if (!command) return

    if (containerId && containerStatus === 'running') {
      if (course?.sqlTerminal) {
        if (sqlTerminalRef.current) {
          sqlTerminalRef.current.sendCommand(command)
        } else {
          console.warn('SQL Terminal组件未准备就绪')
        }
        return
      }

      if (course?.codeTerminal) {
        if (codeTerminalRef.current) {
          const codeMatch = command.match(/python3 - << 'PYTHON_EOF'\n([\s\S]*?)\nPYTHON_EOF$/)
          const code = codeMatch ? codeMatch[1] : command
          const execLanguage = button.getAttribute('data-language') || 'bash'
          codeTerminalRef.current.setCode(code)
          codeTerminalRef.current.executeCode(code, execLanguage)
        } else {
          console.warn('CodeTerminal组件未准备就绪')
        }
        return
      }

      if (terminalRef.current) {
        terminalRef.current.sendCommand(command)
        terminalRef.current.focus()
      } else {
        console.warn('Terminal组件未准备就绪')
      }
      return
    }

    if (containerStatus !== 'running') {
      alert('请先启动容器后再执行命令')
    }
  }, [containerId, containerStatus, course?.sqlTerminal, course?.codeTerminal, sqlTerminalRef, terminalRef, codeTerminalRef])
}
