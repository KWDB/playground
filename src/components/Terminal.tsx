import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// 组件属性接口
interface TerminalProps {
  containerId: string;
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
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?container_id=${containerId}&session_id=${Date.now()}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.write('\r\n连接到容器终端...\r\n\r\n');
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (xtermRef.current && message.type === 'output') {
          xtermRef.current.write(message.data);
        } else if (message.type === 'error') {
          xtermRef.current.write(`\r\n错误: ${message.data}\r\n`);
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
    if (containerId) {
      connectWebSocket();
    }
    
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
    <div className="h-full w-full p-2" style={{ backgroundColor: '#0d1117' }}>
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