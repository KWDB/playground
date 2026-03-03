import { ErrorInfo } from '../types'

export const getErrorInfo = (errorMessage: string): ErrorInfo => {
  const lowerError = errorMessage.toLowerCase()

  if (lowerError.includes('/bin/bash') && lowerError.includes('no such file')) {
    return {
      title: '镜像兼容性问题',
      description: '当前镜像不包含所需的 shell 环境',
      reason: '某些最小化镜像不包含完整的 shell 环境或特定命令',
      solutions: [
        '系统正在尝试自动适配镜像类型，请稍等片刻',
        '如果问题持续，请切换到包含完整环境的镜像',
        '联系管理员检查课程配置和镜像兼容性',
        '查看课程文档了解推荐的镜像类型',
      ],
      icon: '🔧',
    }
  }

  if (lowerError.includes('container failed to start') && lowerError.includes('exitcode')) {
    const exitCodeMatch = lowerError.match(/exitcode[=:]?(\d+)/)
    const exitCode = exitCodeMatch ? exitCodeMatch[1] : 'unknown'
    return {
      title: '容器启动异常',
      description: `容器启动后异常退出 (退出码: ${exitCode})`,
      reason: '容器内部程序执行失败或配置错误',
      solutions: [
        '检查容器镜像是否支持当前的启动配置',
        '查看容器日志获取详细错误信息',
        '确认镜像版本和课程要求是否匹配',
        '联系管理员检查容器配置和启动参数',
      ],
      icon: '🚫',
    }
  }

  if (lowerError.includes('no such image') || lowerError.includes('pull access denied')) {
    return {
      title: '镜像拉取失败',
      description: '无法获取指定的容器镜像',
      reason: '镜像不存在、网络连接问题或权限不足',
      solutions: [
        '检查网络连接是否正常',
        '确认镜像名称是否正确',
        '检查 Docker Hub 或镜像仓库的访问权限',
        '尝试使用其他镜像源或联系管理员',
      ],
      icon: '📦',
    }
  }

  if (lowerError.includes('image') && lowerError.includes('not found')) {
    return {
      title: '镜像拉取失败',
      description: '无法找到指定的 Docker 镜像',
      reason: '镜像名称错误、镜像不存在或网络连接问题',
      solutions: [
        '检查镜像名称和标签是否正确',
        '确认网络连接正常，可能需要配置代理',
        '尝试使用其他镜像源或联系管理员',
        '检查 Docker Hub 或私有仓库的访问权限',
      ],
      icon: '📦',
    }
  }

  if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
    return {
      title: '权限访问错误',
      description: '容器操作权限不足',
      reason: 'Docker 服务权限配置问题或用户权限不足',
      solutions: [
        '检查 Docker 服务是否正常运行',
        '确认当前用户是否有 Docker 操作权限',
        '联系系统管理员检查权限配置',
        '尝试重启 Docker 服务',
      ],
      icon: '🔒',
    }
  }

  if (lowerError.includes('no space left') || lowerError.includes('disk space')) {
    return {
      title: '存储空间不足',
      description: '系统磁盘空间不足，无法创建容器',
      reason: '服务器存储空间已满或接近满载',
      solutions: [
        '清理不必要的文件和容器',
        '联系管理员扩展存储空间',
        '删除未使用的 Docker 镜像和容器',
        '检查系统磁盘使用情况',
      ],
      icon: '💾',
    }
  }

  if (lowerError.includes('network') || lowerError.includes('connection')) {
    return {
      title: '网络连接问题',
      description: '容器网络配置或连接异常',
      reason: '网络配置错误、防火墙阻拦或网络服务异常',
      solutions: [
        '检查网络连接是否正常',
        '确认防火墙设置允许相关端口',
        '检查 Docker 网络配置',
        '联系网络管理员检查网络策略',
      ],
      icon: '🌐',
    }
  }

  if (lowerError.includes('timeout') && !lowerError.includes('network')) {
    return {
      title: '操作超时',
      description: '容器启动或操作超时',
      reason: '服务器响应缓慢、负载过高或配置问题',
      solutions: [
        '稍后重试，服务器可能正在处理其他任务',
        '检查网络连接稳定性',
        '联系管理员检查服务器负载状态',
        '尝试使用更轻量级的镜像',
      ],
      icon: '⏱️',
    }
  }

  if (lowerError.includes('port') && (lowerError.includes('already') || lowerError.includes('in use'))) {
    return {
      title: '端口冲突',
      description: '所需端口已被其他服务占用',
      reason: '多个容器或服务尝试使用相同端口',
      solutions: [
        '停止占用端口的其他容器或服务',
        '等待片刻后重试，系统会自动分配可用端口',
        '联系管理员检查端口使用情况',
        '检查是否有重复的容器实例',
      ],
      icon: '🔌',
    }
  }

  return {
    title: '容器启动异常',
    description: '遇到了预期之外的问题',
    reason: `系统错误: ${errorMessage}`,
    solutions: [
      '请稍后重试，问题可能是临时的',
      '刷新页面重新加载课程',
      '如果问题持续存在，请联系技术支持',
      '可以尝试切换到其他课程后再回来',
    ],
    icon: '🔧',
  }
}

export const getCourseNotFoundError = (): ErrorInfo => ({
  title: '课程未找到',
  description: '请求的课程不存在或已被删除',
  reason: '课程ID无效或课程配置文件缺失',
  solutions: [
    '检查课程ID是否正确',
    '返回课程列表选择其他课程',
    '联系管理员确认课程状态',
  ],
  icon: '📚',
})
