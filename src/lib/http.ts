// 通用的安全 JSON 请求工具函数
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  let payload: unknown = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => ({}))
  } else {
    const text = await res.text().catch(() => '')
    try { payload = JSON.parse(text) } catch { payload = { message: text } }
  }
  if (!res.ok) {
    let message: string | undefined
    if (typeof payload === 'object' && payload !== null) {
      const rec = payload as Record<string, unknown>
      const maybeError = rec.error
      const maybeMessage = rec.message
      if (typeof maybeError === 'string') message = maybeError
      else if (typeof maybeMessage === 'string') message = maybeMessage
    }
    throw new Error(message ?? `HTTP ${res.status}`)
  }
  return payload as T
}