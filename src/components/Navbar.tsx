import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Home, BookOpen } from 'lucide-react';


const GitHubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <title>GitHub</title>
    <path
      fill="currentColor"
      d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.385-1.334-1.753-1.334-1.753-1.09-.746.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.833 2.807 1.303 3.492.997.108-.774.418-1.303.76-1.603-2.665-.304-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.236-3.22-.123-.304-.536-1.527.117-3.18 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 013.003-.404c1.02.005 2.043.138 3 .404 2.29-1.552 3.296-1.23 3.296-1.23.655 1.653.242 2.876.118 3.18.77.84 1.236 1.91 1.236 3.22 0 4.61-2.807 5.624-5.48 5.92.43.372.823 1.102.823 2.222 0 1.603-.015 2.893-.015 3.289 0 .319.218.694.825.576C20.565 21.8 24 17.3 24 12c0-6.63-5.373-12-12-12z"
    />
  </svg>
);

const Navbar: React.FC = () => {
  const location = useLocation();

  // 判断当前路径是否为活跃状态
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo 和品牌名称 */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                KWDB Playground
              </h1>
              <p className="text-xs text-gray-500">交互式学习平台</p>
            </div>
          </div>

          {/* 导航链接（桌面端） */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive('/')
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="font-medium">首页</span>
            </Link>
            
            <Link
              to="/courses"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive('/courses')
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">课程列表</span>
            </Link>

            {/* Github 按钮 - 品牌渐变风格（桌面端） */}
            <a
              href="https://github.com/KWDB/KWDB"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="打开 KWDB Github 仓库"
            >
              <GitHubIcon className="w-4 h-4" />
              <span className="font-medium">Github</span>
            </a>
          </div>

          {/* 移动端菜单按钮（展示示例） */}
          <div className="md:hidden">
            <button className="text-gray-600 hover:text-blue-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 移动端导航菜单 */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive('/')
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="font-medium">首页</span>
            </Link>
            
            <Link
              to="/courses"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive('/courses')
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">课程列表</span>
            </Link>

            {/* Github 外部链接 - 移动端（品牌渐变） */}
            <a
              href="https://github.com/KWDB/KWDB"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <GitHubIcon className="w-4 h-4" />
              <span className="font-medium">Github</span>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;