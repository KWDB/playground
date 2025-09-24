import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// 镜像拉取进度消息接口
interface ImagePullProgressMessage {
  imageName: string;
  status?: string; // 改为可选字段，提高类型安全性
  progress?: string;
  error?: string;
}

// 组件属性接口
interface TerminalProps {
  containerId?: string; // 改为可选参数，支持容器启动过程中的显示
}

// 暴露给父组件的方法接口
export interface TerminalRef {
  sendCommand: (command: string) => void;
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({ containerId }, ref) => {
  // 终端实例和插件引用
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 连接状态管理
  const [, setIsConnected] = useState(false);
  
  // 镜像拉取进度状态管理
  const [imagePullProgress, setImagePullProgress] = useState<ImagePullProgressMessage | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建终端实例并配置现代化样式和主题
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block', // 块状光标
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", Monaco, Menlo, "Ubuntu Mono", "Cascadia Code", "SF Mono", Consolas, monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      lineHeight: 1.4,
      letterSpacing: 0.5,
      allowTransparency: true,
      theme: {
            background: '#0d1117',
            foreground: '#f0f6fc',
            cursor: '#58a6ff',
            cursorAccent: '#0d1117',
            black: '#484f58',
            red: '#ff7b72',
            green: '#7ee787',
            yellow: '#f2cc60',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39c5cf',
            white: '#b1bac4',
            brightBlack: '#6e7681',
            brightRed: '#ffa198',
            brightGreen: '#56d364',
            brightYellow: '#e3b341',
            brightBlue: '#79c0ff',
            brightMagenta: '#d2a8ff',
            brightCyan: '#56d4dd',
            brightWhite: '#f0f6fc'
          },
      scrollback: 10000,
        tabStopWidth: 4,
        smoothScrollDuration: 120,
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 5
    });

    // 创建并加载fit插件
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // 打开终端
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // 保存引用
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

     // 处理用户输入 - 发送JSON格式消息
     terminal.onData((data) => {
       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
         const message = {
           type: 'input',
           data: data
         };
         wsRef.current.send(JSON.stringify(message));
       }
     });

     // 窗口大小变化时调整终端大小
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // 简化的WebSocket连接
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 如果没有containerId，使用特殊的连接来接收镜像拉取进度
    const wsUrl = containerId 
      ? `${protocol}//${window.location.host}/ws/terminal?container_id=${containerId}&session_id=${Date.now()}`
      : `${protocol}//${window.location.host}/ws/terminal?session_id=${Date.now()}&progress_only=true`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (xtermRef.current) {
        xtermRef.current.clear();
        if (containerId) {
          xtermRef.current.write('\r\n连接到容器终端...\r\n\r\n');
        } else {
          xtermRef.current.write('\r\n正在准备容器环境...\r\n\r\n');
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (xtermRef.current && message.type === 'output') {
          xtermRef.current.write(message.data);
        } else if (message.type === 'error') {
          if (xtermRef.current) {
            xtermRef.current.write(`\r\n错误: ${message.data}\r\n`);
          }
        } else if (message.type === 'image_pull_progress') {
          // 处理镜像拉取进度消息
          const progressData = message.data as ImagePullProgressMessage;
          console.log('收到镜像拉取进度消息:', progressData); // 添加调试日志
          
          setImagePullProgress(progressData);
          
          // 判断是否为致命错误 - 优化错误处理逻辑
          const isFatalError = progressData.error && (
            progressData.status === '拉取失败' ||
            progressData.status === '镜像不存在' ||
            progressData.status === '网络错误' ||
            progressData.error.includes('failed to pull') ||
            progressData.error.includes('repository does not exist') ||
            progressData.error.includes('connection refused') ||
            progressData.error.includes('timeout')
          );
          
          // 判断是否为成功消息
          const isSuccessMessage = progressData.status === '拉取成功' || 
            progressData.status === 'Pull complete' ||
            progressData.status === '镜像已存在';
          
          // 判断是否为正常进度消息（非错误）
          const isNormalProgress = !progressData.error && (
            progressData.status?.includes('Downloading') ||
            progressData.status?.includes('Extracting') ||
            progressData.status?.includes('Pulling') ||
            progressData.status?.includes('Waiting') ||
            progressData.progress
          );
          
          console.log('进度消息分析:', {
            isFatalError,
            isSuccessMessage,
            isNormalProgress,
            status: progressData.status,
            error: progressData.error,
            progress: progressData.progress
          });
          
          // 显示进度界面
          if (progressData.status === '开始拉取镜像' || isNormalProgress) {
            setShowProgress(true);
            console.log('开始显示镜像拉取进度界面');
          } else if (progressData.status === '拉取完成' || isFatalError || isSuccessMessage) {
            // 只有在拉取完成或遇到致命错误时才隐藏进度界面
            console.log('镜像拉取完成或遇到致命错误，准备隐藏进度界面:', { 
              status: progressData.status, 
              isFatalError, 
              error: progressData.error 
            });
            setTimeout(() => {
              setShowProgress(false);
              setImagePullProgress(null);
            }, isFatalError ? 5000 : 2000); // 错误消息显示更长时间
          }
          
          // 正常进度消息不自动隐藏，等待成功或错误消息
          
          // 在终端中也显示进度信息
          if (xtermRef.current) {
            let displayText = '';
            
            if (isFatalError) {
              // 致命错误用红色显示
              displayText = `\r\n\x1b[31m[错误] ${progressData.error}\x1b[0m`;
            } else if (isSuccessMessage) {
              // 成功消息用绿色显示
              displayText = `\r\n\x1b[32m[成功] ${progressData.status}\x1b[0m`;
            } else if (isNormalProgress) {
              // 正常进度用蓝色显示
              displayText = `\r\n\x1b[36m[进度] ${progressData.status}\x1b[0m`;
              if (progressData.progress) {
                displayText += ` - ${progressData.progress}`;
              }
            } else if (progressData.error) {
              // 其他错误用黄色显示（警告级别）
              displayText = `\r\n\x1b[33m[警告] ${progressData.error}\x1b[0m`;
            } else if (progressData.status) {
              // 其他状态消息用默认颜色
              displayText = `\r\n\x1b[37m[信息] ${progressData.status}\x1b[0m`;
            }
            
            if (displayText) {
              xtermRef.current.write(displayText);
            }
          }
        }
      } catch {
        // 如果不是JSON格式，直接显示原始数据
        if (xtermRef.current) {
          xtermRef.current.write(event.data);
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (xtermRef.current) {
        xtermRef.current.write('\r\n连接已断开\r\n');
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
      if (xtermRef.current) {
        xtermRef.current.write('\r\n连接错误\r\n');
      }
    };
  }, [containerId]);

  // 发送命令到终端的方法
  const sendCommand = useCallback((command: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type: 'input',
        data: command + '\r'
      };
      wsRef.current.send(JSON.stringify(message));
      
      // 在终端显示命令
      // if (xtermRef.current) {
      //   xtermRef.current.write(command + '\r\n');
      // }
    }
  }, []);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendCommand
  }), [sendCommand]);

  // 自动连接WebSocket
  useEffect(() => {
    // 只要组件渲染就建立连接，用于接收镜像拉取进度或终端输出
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [containerId, connectWebSocket]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="h-full w-full p-2 relative" style={{ backgroundColor: '#0d1117' }}>
      {/* 镜像拉取进度显示界面 */}
      {showProgress && imagePullProgress && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full mb-3">
                  {imagePullProgress.error ? (
                    <span className="text-red-400 text-xl">❌</span>
                  ) : (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {imagePullProgress.error ? '拉取失败' : '正在拉取镜像'}
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  镜像: <span className="font-mono text-blue-400">{imagePullProgress.imageName}</span>
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-gray-400">
                  状态: <span className="text-white">{imagePullProgress.status || '正在处理...'}</span>
                </div>
                
                {imagePullProgress.progress && (
                  <div className="text-sm text-gray-400">
                    进度: <span className="text-green-400">{imagePullProgress.progress}</span>
                  </div>
                )}
                
                {imagePullProgress.error && (
                  <div className="text-sm text-red-400 bg-red-900 bg-opacity-20 p-2 rounded border border-red-700">
                    错误: {imagePullProgress.error}
                  </div>
                )}
                
                {!imagePullProgress.error && (
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                )}
              </div>
              
              {imagePullProgress.status === '拉取完成' && (
                <div className="mt-4 text-green-400 text-sm">
                  ✅ 镜像拉取成功，正在启动容器...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 终端显示区域 */}
      <div 
        ref={terminalRef} 
        className="terminal-display terminal-font terminal-glow terminal-scrollbar rounded-lg border border-gray-700 bg-gray-800"
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: '#0d1117'
        }}
      />
    </div>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;