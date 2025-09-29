import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// 镜像拉取进度消息接口
interface ImagePullProgressMessage {
  imageName: string;
  status?: string;
  progress?: string;
  error?: string;
  progressPercent?: number;
  detail?: string;
  lastUpdated?: number;
}

// 终端组件属性接口
interface TerminalProps {
  containerId?: string; // 改为可选参数，支持容器启动过程中的显示
}

// 终端引用接口
export interface TerminalRef {
  sendCommand: (command: string) => void;
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({ containerId }, ref) => {
  // 引用和状态管理
  const xtermRef = useRef<XTerm | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // 进度专用 WebSocket 引用，在容器ID未就绪时也能接收镜像拉取进度
  const wsProgressRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // 记录上一次的进度与状态，减少终端内重复输出，避免闪烁
  const lastProgressRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string>('');
  
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const [imagePullProgress, setImagePullProgress] = useState<ImagePullProgressMessage | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // 防抖函数用于窗口大小调整
  const debounce = useCallback(<T extends (...args: unknown[]) => void>(func: T, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }, []);

  // 调整终端大小的函数
  const resizeTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit();
        
        // 发送新的终端尺寸到服务器
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const { cols, rows } = xtermRef.current;
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols,
            rows
          }));
        }
      } catch (error) {
        console.warn('调整终端大小失败:', error);
      }
    }
  }, []);

  // 防抖的调整大小函数
  const debouncedResize = useCallback(
    debounce(resizeTerminal, 150),
    [resizeTerminal, debounce]
  );

  // 发送命令到终端
  const sendCommand = useCallback((command: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type: 'input',
        data: command + '\r' // 添加回车符
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送命令');
    }
  }, []);

  // 解析镜像拉取进度百分比的辅助函数
  const parseProgressPercent = useCallback((progress?: string): number | null => {
    // 1) 直接匹配百分比（例如 "56%"）
    if (progress) {
      const pctMatch = progress.match(/(\d{1,3})%/);
      if (pctMatch) {
        const val = Math.min(100, Math.max(0, parseInt(pctMatch[1], 10)));
        return isNaN(val) ? null : val;
      }
    }

    // 2) 匹配字节/大小进度（例如 "44.1MB/67.2MB" 或 "1024kB/2048kB"）
    // 提示：Docker拉取进度常见格式为 "xx.x MB/yy.y MB" 或 "xx.x kB/yy.y kB"
    if (!progress) return null;
    const sizeMatch = progress.match(/([0-9]+(?:\.[0-9]+)?)\s*([kMG]?B)\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*([kMG]?B)/i);
    if (sizeMatch) {
      const toBytes = (numStr: string, unit: string) => {
        const num = parseFloat(numStr);
        const u = unit.toUpperCase();
        // 按照常见单位转换：kB=10^3, MB=10^6, GB=10^9（Docker输出通常使用十进制单位）
        const map: Record<string, number> = { KB: 1e3, MB: 1e6, GB: 1e9 };
        const factor = map[u] ?? 1; // B
        return num * factor;
      };

      const cur = toBytes(sizeMatch[1], sizeMatch[2]);
      const total = toBytes(sizeMatch[3], sizeMatch[4]);
      if (total > 0) {
        const pct = Math.min(100, Math.max(0, (cur / total) * 100));
        return Math.round(pct);
      }
    }

    return null;
  }, []);

  // WebSocket连接管理函数
  const connectWebSocket = useCallback(() => {
    if (!containerId || !xtermRef.current) return;

    // 关闭现有连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/terminal?container_id=${containerId}`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('终端WebSocket连接已建立');
          setIsConnected(true);
          reconnectAttempts = 0;
          
          // 连接成功后立即调整终端大小
          setTimeout(() => {
            if (fitAddonRef.current) {
              fitAddonRef.current.fit();
            }
          }, 100);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'output' && xtermRef.current) {
              xtermRef.current.write(msg.data);
            } else if (msg.type === 'error' && xtermRef.current) {
              xtermRef.current.write(`\r\n\x1b[31m错误: ${msg.data}\x1b[0m\r\n`);
            } else if (msg.type === 'image_pull_progress') {
              // 修复数据解析：后端发送在 data 字段内
              const payload = msg.data || {};
              const imageName: string = payload.imageName || '未知镜像';
              const status: string = payload.status || '正在拉取镜像...';
              const progressText: string | undefined = payload.progress;
              const errorText: string | undefined = payload.error;

              // 解析百分比，便于确定型进度条显示
              const percent = parseProgressPercent(progressText ?? undefined);

              const progressData: ImagePullProgressMessage = {
                imageName,
                status,
                progress: progressText,
                error: errorText,
                progressPercent: percent ?? undefined,
                lastUpdated: Date.now(),
              };

              setImagePullProgress(progressData);
              setShowProgress(true);

              // 在终端中显示进度信息（防重复输出，阈值为1%或状态变化）
              const statusChanged = lastStatusRef.current !== status;
              const percentChanged = percent != null && (lastProgressRef.current == null || Math.abs(percent - (lastProgressRef.current ?? 0)) >= 1);
              if (xtermRef.current && (statusChanged || percentChanged)) {
                if (errorText) {
                  xtermRef.current.write(`\r\n\x1b[31m❌ 镜像拉取失败: ${errorText}\x1b[0m\r\n`);
                } else if (statusChanged) {
                  xtermRef.current.write(`\r\n\x1b[36m[镜像拉取] ${status}${percent != null ? ` (${percent}%)` : ''}\x1b[0m\r\n`);
                } else if (percentChanged) {
                  xtermRef.current.write(`\r\n\x1b[34m📦 进度: ${progressText ?? ''}${percent != null ? ` | ${percent}%` : ''}\x1b[0m\r\n`);
                }
                lastStatusRef.current = status;
                lastProgressRef.current = percent ?? lastProgressRef.current;
              }

              // 成功与完成判定，平滑隐藏覆盖层
              const isSuccess = (
                (status && (status.includes('拉取完成') || status.includes('Pull complete') || status.includes('Already exists'))) ||
                false
              );
              if (isSuccess || errorText) {
                setTimeout(() => {
                  setShowProgress(false);
                  setImagePullProgress(null);
                  lastProgressRef.current = null;
                  lastStatusRef.current = '';
                }, 1200); // 轻微延迟以便用户可见
              }
            }
          } catch (error) {
            console.warn('解析WebSocket消息失败:', error);
            // 如果不是JSON格式，直接作为输出处理
            if (xtermRef.current) {
              xtermRef.current.write(event.data);
            }
          }
        };

        ws.onclose = (event) => {
          console.log('终端WebSocket连接已关闭', event.code, event.reason);
          setIsConnected(false);
          
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\x1b[33m连接已断开\x1b[0m\r\n');
          }
          
          // 守卫：如果容器ID缺失或页面已导航离开，则不再重连
          const shouldStopReconnect = !containerId || document.visibilityState === 'hidden';
          if (shouldStopReconnect) {
            return;
          }
          
          // 实现指数退避重连策略
          if (reconnectAttempts < maxReconnectAttempts && !event.wasClean) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
            console.log(`${delay}ms 后尝试重连 (第 ${reconnectAttempts + 1} 次)`);
            
            setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          }
        };

        ws.onerror = (error) => {
          console.error('终端WebSocket连接错误:', error);
          setIsConnected(false);
          
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\x1b[31m连接错误\x1b[0m\r\n');
          }
        };

      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        setIsConnected(false);
      }
    };

    connect();
  }, [containerId, parseProgressPercent]);

  // 进度专用 WebSocket 连接（progress_only=true），用于容器启动阶段接收镜像拉取进度
  const connectProgressOnly = useCallback(() => {
    // 当容器ID未就绪时，建立进度专用连接
    if (containerId) return;

    // 关闭已有进度连接，避免重复
    if (wsProgressRef.current) {
      wsProgressRef.current.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal?progress_only=true`;
      const ws = new WebSocket(wsUrl);
      wsProgressRef.current = ws;

      ws.onopen = () => {
        console.log('进度专用WebSocket连接已建立');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'image_pull_progress') {
            const payload = msg.data || {};
            const imageName: string = payload.imageName || '未知镜像';
            const status: string = payload.status || '正在拉取镜像...';
            const progressText: string | undefined = payload.progress;
            const errorText: string | undefined = payload.error;

            const percent = parseProgressPercent(progressText ?? undefined);

            const progressData: ImagePullProgressMessage = {
              imageName,
              status,
              progress: progressText,
              error: errorText,
              progressPercent: percent ?? undefined,
              lastUpdated: Date.now(),
            };

            setImagePullProgress(progressData);
            setShowProgress(true);

            const statusChanged = lastStatusRef.current !== status;
            const percentChanged = percent != null && (lastProgressRef.current == null || Math.abs(percent - (lastProgressRef.current ?? 0)) >= 1);
            if (statusChanged || percentChanged) {
              // 进度专用连接仅显示覆盖层，不输出到终端，避免重复
              lastStatusRef.current = status;
              lastProgressRef.current = percent ?? lastProgressRef.current;
            }

            const isSuccess = (
              (status && (status.includes('拉取完成') || status.includes('Pull complete') || status.includes('Already exists'))) ||
              false
            );
            if (isSuccess || errorText) {
              setTimeout(() => {
                setShowProgress(false);
                setImagePullProgress(null);
                lastProgressRef.current = null;
                lastStatusRef.current = '';
              }, 1200);
            }
          }
        } catch (error) {
          console.warn('解析进度专用WebSocket消息失败:', error);
        }
      };

      ws.onclose = () => {
        console.log('进度专用WebSocket连接已关闭');
      };

      ws.onerror = (error) => {
        console.error('进度专用WebSocket连接错误:', error);
      };
    } catch (error) {
      console.error('创建进度专用WebSocket连接失败:', error);
    }
  }, [containerId, parseProgressPercent]);

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建终端实例 - 优化配置以确保输入正常工作
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#000000',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#d19a66',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#ffffff',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#d19a66',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      },
      allowTransparency: true,
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4
    });

    // 创建并加载 FitAddon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // 打开终端
    terminal.open(terminalRef.current);

    // 设置引用
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 设置输入处理 - 确保用户输入能正确发送到服务器
    terminal.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message = {
          type: 'input',
          data: data
        };
        wsRef.current.send(JSON.stringify(message));
      }
    });

    // 初始调整大小
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // 设置 ResizeObserver 监听容器大小变化
    if (terminalRef.current) {
      resizeObserverRef.current = new ResizeObserver(debouncedResize);
      resizeObserverRef.current.observe(terminalRef.current);
    }

    // 监听窗口大小变化
    window.addEventListener('resize', debouncedResize);

    return () => {
      // 清理资源
      window.removeEventListener('resize', debouncedResize);
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      if (terminal) {
        terminal.dispose();
      }
    };
  }, [debouncedResize]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendCommand
  }), [sendCommand]);

  // WebSocket连接管理
  useEffect(() => {
    if (containerId && xtermRef.current) {
      // 容器ID就绪：使用终端连接
      connectWebSocket();
      // 关闭进度专用连接，避免双连接
      if (wsProgressRef.current) {
        wsProgressRef.current.close();
        wsProgressRef.current = null;
      }
    } else {
      // 容器ID未就绪：建立进度专用连接以接收镜像拉取进度
      connectProgressOnly();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (wsProgressRef.current) {
        wsProgressRef.current.close();
        wsProgressRef.current = null;
      }
    };
  }, [containerId, connectWebSocket, connectProgressOnly]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  // 镜像拉取进度组件 - 优化样式和动画
  const ImagePullProgress = () => {
    if (!showProgress || !imagePullProgress) return null;

    const percent = imagePullProgress.progressPercent;
    const widthStyle = percent != null ? { width: `${Math.max(0, Math.min(100, percent))}%` } : undefined;

    return (
      <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                {/* 旋转的加载图标 */}
                <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">正在拉取镜像</h3>
              <p className="text-gray-300 text-sm break-all">{imagePullProgress.imageName}</p>
            </div>
            
            {imagePullProgress.error ? (
              <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <div className="font-medium mb-1">拉取失败</div>
                <div className="text-xs opacity-80">{imagePullProgress.error}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {imagePullProgress.status && (
                  <div className="text-blue-300 text-sm font-medium">
                    {imagePullProgress.status} {percent != null && <span className="ml-1 text-gray-300">({percent}%)</span>}
                  </div>
                )}
                {imagePullProgress.progress && (
                  <div className="text-gray-400 text-xs font-mono bg-gray-700/50 rounded px-3 py-2">
                    {imagePullProgress.progress}
                  </div>
                )}

                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  {percent != null ? (
                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-200" style={widthStyle}></div>
                  ) : (
                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-900">
      {/* 终端容器 - 优化布局以防止文本重叠 */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full overflow-hidden"
        style={{
          minHeight: '200px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: '14px',
          lineHeight: '1.2',
          letterSpacing: '0.5px'
        }}
      />
      
      {/* 镜像拉取进度覆盖层 */}
      <ImagePullProgress />
      
      {/* 连接状态指示器 */}
      {containerId && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} title={isConnected ? '已连接' : '未连接'} />
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;