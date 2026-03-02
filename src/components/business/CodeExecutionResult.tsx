interface CodeExecutionResultProps {
  stdout: string;
  stderr: string;
  className?: string;
}

const CodeExecutionResult: React.FC<CodeExecutionResultProps> = ({
  stdout,
  stderr,
  className = ''
}) => {
  const hasOutput = stdout || stderr;
  const hasStdout = stdout.trim().length > 0;
  const hasStderr = stderr.trim().length > 0;

  // 检测 stderr 是否为警告（warning）而非错误（error）
  // 警告通常包含 warning, warn, 注意, 建议 等关键词
  const isWarning = hasStderr && (
    stderr.toLowerCase().includes('warning') ||
    stderr.toLowerCase().includes('warn') ||
    stderr.includes('警告') ||
    stderr.includes('注意') ||
    stderr.includes('建议')
  );

  // 根据类型选择颜色
  const stderrColor = isWarning ? 'text-[#d97706]' : 'text-[#dc2626]';  // 黄色 vs 红色
  const stderrDotColor = isWarning ? 'bg-[#d97706]' : 'bg-[#dc2626]';

  return (
    <div
      className={`w-full h-full flex flex-col bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg overflow-hidden ${className}`}
      role="region"
      aria-label="代码执行结果"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] border-b border-[var(--color-border-default)]">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          执行结果
        </span>
        {hasOutput && (
          <div className="flex items-center gap-3 text-xs">
            {hasStdout && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
                <span className="text-[var(--color-text-secondary)]">stdout</span>
              </span>
            )}
            {hasStderr && (
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${stderrDotColor}`} />
                <span className="text-[var(--color-text-secondary)]">{isWarning ? 'warning' : 'stderr'}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 输出内容 */}
      <div className="flex-1 overflow-auto p-3 font-mono text-sm bg-[#fafafa]">
        {!hasOutput ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
            暂无输出
          </div>
        ) : (
          <div className="space-y-2">
            {/* stdout 输出 */}
            {hasStdout && (
              <pre className="whitespace-pre-wrap break-all text-[#1a1a1a]">
                {stdout}
              </pre>
            )}

            {/* stderr 输出 */}
            {hasStderr && (
              <pre className={`whitespace-pre-wrap break-all ${stderrColor}`}>
                {stderr}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeExecutionResult;
