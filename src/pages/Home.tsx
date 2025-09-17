import { Link } from 'react-router-dom'
import { BookOpen, Play, Terminal } from 'lucide-react'

export function Home() {
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
        
        <Link
          to="/courses"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <BookOpen className="h-5 w-5 mr-2" />
          开始学习
        </Link>
      </div>
    </div>
  )
}