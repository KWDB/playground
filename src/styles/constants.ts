// 样式常量文件 - 提高Tailwind CSS类的可维护性

// 按钮样式
export const buttonStyles = {
  primary: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-lg shadow-blue-500/25 font-medium',
  secondary: 'px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium',
  danger: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 hover:shadow-lg shadow-red-500/25 font-medium',
  success: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 hover:shadow-lg shadow-green-500/25 font-medium',
  ghost: 'px-4 py-2 bg-transparent text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-gray-200',
  disabled: 'px-4 py-2 bg-gray-400 text-gray-600 rounded-lg cursor-not-allowed'
};

// 标签页样式
export const tabStyles = {
  active: 'px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 bg-blue-600 text-white shadow-lg shadow-blue-500/25',
  inactive: 'px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200',
  terminalActive: 'px-3 lg:px-4 py-2 lg:py-2.5 flex items-center space-x-1 lg:space-x-2 text-xs lg:text-sm font-medium rounded-lg transition-all duration-300 bg-green-600 text-white shadow-lg shadow-green-500/25',
  terminalInactive: 'px-3 lg:px-4 py-2 lg:py-2.5 flex items-center space-x-1 lg:space-x-2 text-xs lg:text-sm font-medium rounded-lg transition-all duration-300 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white border border-gray-600'
};

// 面板样式
export const panelStyles = {
  container: 'w-full lg:w-1/2 flex flex-col bg-white border-r border-gray-300 shadow-sm',
  header: 'p-3 lg:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200',
  content: 'flex-1 p-6 overflow-auto bg-white',
  terminalContainer: 'w-full lg:w-1/2 flex flex-col bg-gray-900 min-h-0',
  terminalHeader: 'p-3 lg:p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700'
};

// 状态栏样式
export const statusBarStyles = {
  container: 'flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm',
  statusSection: 'flex items-center space-x-4',
  actionSection: 'flex items-center space-x-3'
};

// 响应式间距
export const spacing = {
  containerGap: 'space-x-1 lg:space-x-2',
  flexGap: 'flex flex-wrap gap-2',
  padding: {
    sm: 'p-2 lg:p-3',
    md: 'p-3 lg:p-4',
    lg: 'p-4 lg:p-6'
  }
};

// 文本样式
export const textStyles = {
  heading: 'text-lg lg:text-xl font-semibold text-gray-800',
  subheading: 'text-base lg:text-lg font-medium text-gray-700',
  body: 'text-sm lg:text-base text-gray-600',
  caption: 'text-xs lg:text-sm text-gray-500',
  label: 'text-xs lg:text-sm font-medium text-gray-700'
};

// 图标样式
export const iconStyles = {
  sm: 'h-3 lg:h-4 w-3 lg:w-4',
  md: 'h-4 lg:h-5 w-4 lg:w-5',
  lg: 'h-5 lg:h-6 w-5 lg:w-6'
};

// 动画样式
export const animations = {
  fadeIn: 'animate-fade-in',
  slideIn: 'animate-slide-in',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce'
};

// 阴影样式
export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  colored: {
    blue: 'shadow-lg shadow-blue-500/25',
    green: 'shadow-lg shadow-green-500/25',
    red: 'shadow-lg shadow-red-500/25',
    gray: 'shadow-lg shadow-gray-500/25'
  }
};

// 边框样式
export const borders = {
  light: 'border border-gray-200',
  medium: 'border border-gray-300',
  dark: 'border border-gray-700',
  colored: {
    blue: 'border border-blue-200',
    green: 'border border-green-200',
    red: 'border border-red-200'
  }
};

// 背景样式
export const backgrounds = {
  primary: 'bg-blue-600',
  secondary: 'bg-gray-600',
  success: 'bg-green-600',
  danger: 'bg-red-600',
  warning: 'bg-yellow-600',
  light: 'bg-gray-50',
  white: 'bg-white',
  dark: 'bg-gray-900',
  gradient: {
    blue: 'bg-gradient-to-r from-blue-50 to-indigo-50',
    gray: 'bg-gradient-to-r from-gray-800 to-gray-900'
  }
};