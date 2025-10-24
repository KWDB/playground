import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play, Terminal, X } from 'lucide-react'
import EnvCheckPanel from '@/components/business/EnvCheckPanel'
import EnvCheckButton from '@/components/business/EnvCheckButton'

export function Home() {
  // 控制环境检测弹窗显示的状态
  const [showEnvModal, setShowEnvModal] = useState(false)

  // 监听 ESC 键以关闭弹窗，提升可用性
  useEffect(() => {
    if (!showEnvModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEnvModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showEnvModal])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          KWDB Playground
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          本地离线交互式课程学习平台，通过容器化环境实时练习命令
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">丰富课程</h3>
            <p className="text-gray-600 text-sm">精心设计的课程内容，从入门到进阶</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Terminal className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">实时终端</h3>
            <p className="text-gray-600 text-sm">Shell 和 SQL 双终端，支持实时交互</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Play className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">容器化环境</h3>
            <p className="text-gray-600 text-sm">隔离的学习环境，安全可靠</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Link
            to="/courses"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <BookOpen className="h-5 w-5 mr-2" />
            开始学习
          </Link>
        </div>
        

          
        {/* 按钮触发的悬浮面板（弹窗） */}
        {showEnvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩：点击外部区域关闭 */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowEnvModal(false)}
            />
            {/* 弹窗容器：居中显示，支持响应式与滚动 */}
            <div
              id="env-check-modal"
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-3xl mx-4 sm:mx-6"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all duration-200">
                {/* 弹窗头部：标题 + 关闭按钮 */}
                <div className="flex items-center justify-between px-4 py-3 border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">环境检测</h3>
                  <button
                    onClick={() => setShowEnvModal(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 text-gray-600"
                    aria-label="关闭环境检测面板"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* 弹窗内容：完整检测数据，强制展开并可滚动查看 */}
                <div className="max-h-[80vh] overflow-y-auto p-3 sm:p-4">
                  <EnvCheckPanel alwaysExpanded />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 浮动环境检测按钮：显著且不干扰主操作（右下角），弹窗打开时隐藏 */}
      {!showEnvModal && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40">
          <EnvCheckButton onClick={() => setShowEnvModal(true)} />
        </div>
      )}
    </div>
  )
}