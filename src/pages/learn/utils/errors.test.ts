import { describe, expect, it } from 'vitest'
import { getCourseNotFoundError, getErrorInfo } from './errors'

describe('learn error utils', () => {
  it('returns port conflict info', () => {
    const info = getErrorInfo('bind: address already in use for port 3006')
    expect(info.title).toBe('端口冲突')
    expect(info.icon).toBe('🔌')
  })

  it('returns timeout info', () => {
    const info = getErrorInfo('operation timeout while starting container')
    expect(info.title).toBe('操作超时')
  })

  it('returns image not found info', () => {
    const info = getErrorInfo('no such image: xxx')
    expect(info.title).toBe('镜像拉取失败')
  })

  it('returns permission info', () => {
    const info = getErrorInfo('permission denied by daemon')
    expect(info.title).toBe('权限访问错误')
  })

  it('returns disk info', () => {
    const info = getErrorInfo('no space left on device')
    expect(info.title).toBe('存储空间不足')
  })

  it('returns network info', () => {
    const info = getErrorInfo('network connection reset')
    expect(info.title).toBe('网络连接问题')
  })

  it('returns default unknown error info', () => {
    const info = getErrorInfo('something-unknown')
    expect(info.title).toBe('容器启动异常')
  })

  it('returns not found course info', () => {
    const info = getCourseNotFoundError()
    expect(info.title).toBe('课程未找到')
    expect(info.solutions.length).toBeGreaterThan(0)
  })
})
