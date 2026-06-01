export const LEARN_START_TIPS = [
  '镜像下载较慢时，可以先切换到更近的镜像源再启动课程。',
  '课程启动前会自动预检端口冲突，端口被占用时可以换一个主机端口。',
  'Markdown 里的 Run 按钮会把命令发送到右侧终端，适合逐步验证课程步骤。',
  'Shell 终端支持直接输入命令，也可以配合课程里的可执行代码块快速练习。',
  'SQL 终端最后一行按 Enter 可执行，Shift+Enter 可以换行继续编辑。',
  'Code 终端运行后会保留输出，方便你对比每次代码修改的结果。',
  '暂时离开时可以暂停容器，下次恢复后继续使用当前学习环境。',
  '遇到 Docker 或镜像源问题时，可以先打开环境检查查看诊断结果。',
  'Shell 终端支持点击定位光标位置，方便快速修改命令参数。',
] as const

export const pickRandomLearnStartTip = (random = Math.random): string => {
  const index = Math.min(
    LEARN_START_TIPS.length - 1,
    Math.floor(random() * LEARN_START_TIPS.length)
  )
  return LEARN_START_TIPS[index]
}
