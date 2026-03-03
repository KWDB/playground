import { Link } from 'react-router-dom'
import { ErrorInfo } from '../types'

type Props = {
  error?: string | null
  errorInfo: ErrorInfo
}

export const LearnErrorState = ({ error, errorInfo }: Props) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-8 py-6 border-b border-gray-200">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-bounce">{errorInfo.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h1>
            <p className="text-gray-600 text-lg">{errorInfo.description}</p>
          </div>
        </div>
        <div className="p-8">
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-400 rounded-r-lg p-5 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-red-800 mb-2">错误原因</h3>
                <p className="text-red-700 text-sm leading-relaxed">{errorInfo.reason}</p>
                {error && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium text-sm transition-colors duration-200 select-none">
                      🔍 查看详细错误信息
                    </summary>
                    <div className="mt-3 p-4 bg-red-200/50 rounded-lg border border-red-300">
                      <pre className="font-mono text-xs text-red-800 whitespace-pre-wrap break-all leading-relaxed">
                        {error}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button
              onClick={() => window.location.reload()}
              className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <span className="flex items-center justify-center">重试启动</span>
            </button>
            <Link
              to="/courses"
              className="group relative px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-medium shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95 text-center"
            >
              <span className="flex items-center justify-center">返回课程列表</span>
            </Link>
          </div>
          <div className="pt-6 border-t border-gray-200 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm leading-relaxed">
                <span className="font-medium">💬 需要帮助？</span><br />
                如果问题持续存在，请在 项目 Github 上
                <a href="https://github.com/kwdb/playground/issues" className="text-blue-600 hover:text-blue-800 font-medium ml-1 underline decoration-dotted underline-offset-2 transition-colors duration-200">
                  提交 Issue
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
