import { Link } from 'react-router-dom'
import { ErrorInfo } from '../types'

type Props = {
  error?: string | null
  errorInfo: ErrorInfo
}

export const LearnErrorState = ({ error, errorInfo }: Props) => {
  return (
    <div className="min-h-dvh bg-[var(--color-bg-secondary)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-border-light)]">
          <div>
            <h1 className="text-lg font-medium text-[var(--color-text-primary)] text-balance">{errorInfo.title}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)] text-pretty">{errorInfo.description}</p>
          </div>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-subtle)] p-4 mb-5">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-[var(--color-error)] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-medium text-[var(--color-error)] mb-1.5">错误原因</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-primary)] text-pretty">{errorInfo.reason}</p>
                {error && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[var(--color-error)] hover:text-red-700 font-medium text-sm transition-colors duration-150 select-none">
                      查看详细错误信息
                    </summary>
                    <div className="mt-3 p-3 bg-[var(--color-bg-primary)] rounded-md border border-[var(--color-border-default)]">
                      <pre className="font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-all leading-relaxed">
                        {error}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary text-sm px-5 py-2.5"
            >
              重试启动
            </button>
            <Link
              to="/courses"
              className="btn btn-secondary text-sm px-5 py-2.5 text-center"
            >
              返回课程列表
            </Link>
          </div>
          <div className="pt-5 border-t border-[var(--color-border-light)] text-center">
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed text-pretty">
              <span className="font-medium">需要帮助？</span><br />
              如果问题持续存在，请在 项目 Github 上
              <a href="https://github.com/kwdb/playground/issues" className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)] font-medium ml-1 underline decoration-dotted underline-offset-2 transition-colors duration-150">
                提交 Issue
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
