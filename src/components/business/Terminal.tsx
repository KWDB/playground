import React, { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import ImagePullProgressOverlay from './terminal/ImagePullProgressOverlay';
import ConnectionIndicator from './terminal/ConnectionIndicator';

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
export type ContainerStatus = 'running' | 'starting' | 'stopping' | 'paused' | 'stopped' | 'exited' | 'completed' | 'unknown' | 'error';

interface TerminalProps {
  containerId?: string;
  containerStatus?: ContainerStatus;
}

// 终端引用接口
export interface TerminalRef {
  sendCommand: (command: string) => void;
  focus: () => void;
}

const createTerminalTheme = () => {
  const styles = window.getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    background: pick('--color-bg-secondary', '#141414'),
    foreground: pick('--color-text-primary', '#ededed'),
    cursor: pick('--color-text-primary', '#ededed'),
    selectionBackground: pick('--color-accent-subtle', 'rgba(139, 139, 235, 0.22)'),
    selectionForeground: pick('--color-text-primary', '#ededed'),
    black: pick('--color-text-primary', '#ededed'),
    red: pick('--color-error', '#ef4444'),
    green: pick('--color-success', '#3cc76a'),
    yellow: pick('--color-warning', '#f59e0b'),
    blue: pick('--color-accent-primary', '#8b8beb'),
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: pick('--color-bg-primary', '#0d0d0d'),
    brightBlack: pick('--color-text-secondary', '#8a8a8a'),
    brightRed: pick('--color-error', '#ef4444'),
    brightGreen: pick('--color-success', '#3cc76a'),
    brightYellow: pick('--color-warning', '#f59e0b'),
    brightBlue: pick('--color-accent-hover', '#7a7ae0'),
    brightMagenta: '#e879f9',
    brightCyan: '#67e8f9',
    brightWhite: pick('--color-bg-primary', '#0d0d0d')
  };
};

/** XTerm 终端组件：管理容器命令 WebSocket 与镜像进度 WebSocket */
const Terminal = forwardRef<TerminalRef, TerminalProps>(({ containerId, containerStatus }, ref) => {
  const xtermRef = useRef<XTerm | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsProgressRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastProgressRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string>('');
  const wsContainerIdRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [imagePullProgress, setImagePullProgress] = useState<ImagePullProgressMessage | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const applyTerminalTheme = useCallback(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = createTerminalTheme();
  }, []);

  const debounce = useCallback(<T extends (...args: unknown[]) => void>(func: T, wait: number) => {
    return (...args: Parameters<T>) => {
      const tid = debounceTimeoutRef.current;
      if (tid !== null) {
        clearTimeout(tid);
      }
      debounceTimeoutRef.current = window.setTimeout(() => {
        func(...args);
        debounceTimeoutRef.current = null;
      }, wait);
    };
  }, []);

  const measureCellWidth = useCallback(() => {
    if (!terminalRef.current || !xtermRef.current) return null;
    const core = (xtermRef.current as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth?: number } } } })._core;
    const actual = core?._renderService?.dimensions?.actualCellWidth;
    if (actual && actual > 0) return actual;
    const sample = terminalRef.current.querySelector('.xterm-rows') as HTMLElement | null;
    const styleSource = sample ?? terminalRef.current;
    const style = window.getComputedStyle(styleSource);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = font;
    const width = ctx.measureText('W').width;
    return width > 0 ? width : null;
  }, []);

  const resizeTerminal = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current || !terminalRef.current) return;
    try {
      const proposed = fitAddonRef.current.proposeDimensions?.();
      const width = terminalRef.current.clientWidth;
      const safety = width >= 1600 ? 2 : 1;
      const cellWidth = measureCellWidth();
      const maxCols = cellWidth && width > 0
        ? Math.max(2, Math.floor(width / cellWidth) - safety)
        : null;

      if (proposed?.cols && proposed?.rows) {
        const cols = Math.max(2, proposed.cols - safety);
        const rows = Math.max(1, proposed.rows);
        const clampedCols = maxCols ? Math.min(cols, maxCols) : cols;
        if (clampedCols !== xtermRef.current.cols || rows !== xtermRef.current.rows) {
          xtermRef.current.resize(clampedCols, rows);
        }
      } else {
        fitAddonRef.current.fit();
        if (maxCols && xtermRef.current.cols > maxCols) {
          xtermRef.current.resize(maxCols, xtermRef.current.rows);
        }
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const { cols, rows } = xtermRef.current;
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          data: { cols, rows }
        }));
      }
    } catch (error) {
      console.warn('调整终端大小失败:', error);
    }
  }, [measureCellWidth]);

  const debouncedResize = useMemo(() => debounce(resizeTerminal, 150), [resizeTerminal, debounce]);
  const scheduleResize = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeTerminal();
      });
    });
  }, [resizeTerminal]);

  const sendInput = useCallback((data: string, syncResize: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未连接，无法发送命令');
      return;
    }
    const send = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    };
    if (!syncResize) {
      send();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeTerminal();
        send();
      });
    });
  }, [resizeTerminal]);

  const sendCommand = useCallback((command: string) => {
    const normalized = command.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    sendInput(normalized + '\r', true);
  }, [sendInput]);

  const parseProgressPercent = useCallback((progress?: string): number | null => {
    if (progress) {
      const pctMatch = progress.match(/(\d{1,3})%/);
      if (pctMatch) {
        const val = Math.min(100, Math.max(0, parseInt(pctMatch[1], 10)));
        return isNaN(val) ? null : val;
      }
    }

    if (!progress) return null;
    const sizeMatch = progress.match(/([0-9]+(?:\.[0-9]+)?)\s*([kMG]?B)\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*([kMG]?B)/i);
    if (sizeMatch) {
      const toBytes = (numStr: string, unit: string) => {
        const num = parseFloat(numStr);
        const u = unit.toUpperCase();
        const map: Record<string, number> = { KB: 1e3, MB: 1e6, GB: 1e9 };
        const factor = map[u] ?? 1;
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

  const handleImagePullProgress = useCallback((payload: { imageName?: string; status?: string; progress?: string; error?: string }, echoToTerminal: boolean) => {
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

    if (echoToTerminal && xtermRef.current && (statusChanged || percentChanged)) {
      if (errorText) {
        xtermRef.current.write(`\r\n\x1b[31m❌ 镜像拉取失败: ${errorText}\x1b[0m\r\n`);
      } else if (statusChanged) {
        xtermRef.current.write(`\r\n\x1b[36m[镜像拉取] ${status}${percent != null ? ` (${percent}%)` : ''}\x1b[0m\r\n`);
      } else if (percentChanged) {
        xtermRef.current.write(`\r\n\x1b[34m📦 进度: ${progressText ?? ''}${percent != null ? ` | ${percent}%` : ''}\x1b[0m\r\n`);
      }
    }

    lastStatusRef.current = status;
    if (percent != null) {
      lastProgressRef.current = percent;
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
  }, [parseProgressPercent]);

  const connectWebSocket = useCallback(() => {
    if (!containerId || !xtermRef.current) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      if (wsContainerIdRef.current === containerId) {
        return;
      }
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;

    const connect = () => {
      if (!containerId || containerStatus !== 'running') {
        console.log('跳过终端WS连接：containerId或状态不满足');
        return;
      }
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/terminal?container_id=${containerId}`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        wsContainerIdRef.current = containerId;

        ws.onopen = () => {
          console.log('终端WebSocket连接已建立');
          setIsConnected(true);
          reconnectAttempts = 0;
          
          if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);

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
            } else if (msg.type === 'pong') {
              // 收到服务端心跳响应
            } else if (msg.type === 'connected') {
              if (xtermRef.current) {
                xtermRef.current.write('\r\n\x1b[32m✓ 终端已连接\x1b[0m\r\n');
              }
            }
          } catch (error) {
            console.warn('解析WebSocket消息失败:', error);
            if (xtermRef.current) {
              xtermRef.current.write(event.data);
            }
          }
        };

        ws.onclose = (event) => {
          console.log('终端WebSocket连接已关闭', event.code, event.reason);
          setIsConnected(false);
          
          if (pingIntervalRef.current) {
            window.clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          
          if (xtermRef.current) {
            if (!event.wasClean) {
                xtermRef.current.write('\r\n\x1b[33m连接已断开\x1b[0m\r\n');
            }
          }
          
          const shouldStopReconnect = !containerId || containerStatus !== 'running';
          if (shouldStopReconnect) {
            return;
          }
          
          if (reconnectAttempts < maxReconnectAttempts) {
            if (!event.wasClean) {
                const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
                console.log(`${delay}ms 后尝试重连 (第 ${reconnectAttempts + 1} 次)`);
                
                const tid = window.setTimeout(() => {
                  reconnectAttempts++;
                  connect();
                }, delay);
                reconnectTimerRef.current = tid as unknown as number;
            }
          }
        };

        ws.onerror = (error) => {
          console.error('终端WebSocket连接错误:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [containerId, containerStatus]);

  const connectProgressOnly = useCallback(() => {
    if (containerStatus !== 'starting') return;

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
            handleImagePullProgress(payload, false);
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
  }, [containerStatus, handleImagePullProgress]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      lineHeight: 1,
      theme: createTerminalTheme(),
      allowTransparency: true,
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onData((data) => {
      const normalized = data.length > 1 ? data.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : data;
      const needSync = normalized.length > 1;
      sendInput(normalized, needSync);
    });

    scheduleResize();

    if (terminalRef.current) {
      resizeObserverRef.current = new ResizeObserver(scheduleResize);
      resizeObserverRef.current.observe(terminalRef.current);
    }

    const handleResize = () => {
      scheduleResize();
    };
    const handleDprChange = () => {
      scheduleResize();
      if (dprMedia) {
        dprMedia.removeEventListener('change', handleDprChange);
      }
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener('change', handleDprChange);
    };

    let dprMedia: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener('change', handleDprChange);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    window.addEventListener('resize', handleResize);

    const fontReady = (document as Document & { fonts?: FontFaceSet }).fonts;
    const handleFontReady = () => {
      scheduleResize();
    };
    if (fontReady) {
      fontReady.ready.then(handleFontReady).catch(() => {});
      fontReady.addEventListener('loadingdone', handleFontReady);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      if (dprMedia) {
        dprMedia.removeEventListener('change', handleDprChange);
      }
      if (fontReady) {
        fontReady.removeEventListener('loadingdone', handleFontReady);
      }
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      if (terminal) {
        terminal.dispose();
      }
    };
  }, [debouncedResize, resizeTerminal, scheduleResize, sendInput]);

  useEffect(() => {
    applyTerminalTheme();
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      applyTerminalTheme();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [applyTerminalTheme]);

  useImperativeHandle(ref, () => ({
    sendCommand,
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus();
        setIsFocused(true);
        setTimeout(() => setIsFocused(false), 300);
      }
    }
  }), [sendCommand]);

  useEffect(() => {
    return () => {
      console.log('Terminal component unmounting, cleaning up resources');
      if (wsRef.current) { 
        wsRef.current.close(); 
        wsRef.current = null; 
      }
      if (wsProgressRef.current) { 
        wsProgressRef.current.close(); 
        wsProgressRef.current = null; 
      }
      if (reconnectTimerRef.current) { 
        clearTimeout(reconnectTimerRef.current); 
        reconnectTimerRef.current = null; 
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log('Terminal connection effect triggered:', { containerId, containerStatus });
    
    const connectByStatus = () => {
      const isRunning = containerStatus === 'running';
      const isStarting = containerStatus === 'starting';

      if (isRunning && containerId && xtermRef.current) {
        connectWebSocket();
        
        if (wsProgressRef.current) {
          wsProgressRef.current.close();
          wsProgressRef.current = null;
        }
      } else if (isStarting) {
        connectProgressOnly();
        
        if (wsRef.current && wsContainerIdRef.current !== containerId) {
             wsRef.current.close();
             wsRef.current = null;
             wsContainerIdRef.current = null;
        }
      } else {
        if (wsRef.current) { 
            console.log('Closing WS because status is', containerStatus);
            wsRef.current.close(); 
            wsRef.current = null; 
            wsContainerIdRef.current = null;
        }
        if (wsProgressRef.current) { 
            wsProgressRef.current.close(); 
            wsProgressRef.current = null; 
        }
        if (reconnectTimerRef.current) { 
            clearTimeout(reconnectTimerRef.current); 
            reconnectTimerRef.current = null; 
        }
        setShowProgress(false);
        setImagePullProgress(null);
        lastProgressRef.current = null;
        lastStatusRef.current = '';
      }
    };

    connectByStatus();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page visible, checking connection...');
        connectByStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [containerId, containerStatus, connectWebSocket, connectProgressOnly]);

  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  const ImagePullProgress = () => (
    <ImagePullProgressOverlay show={showProgress} imagePullProgress={imagePullProgress} />
  );

  return (
    // Linear 风格终端容器
    <div 
      className={`relative w-full h-full flex flex-col bg-[var(--color-bg-primary)] border border-[var(--color-border-light)] rounded-lg transition-all duration-200 ${
        isFocused ? 'ring-2 ring-[var(--color-accent-primary)]/30' : ''
      }`} 
      role="region" 
      aria-label="Shell 终端"
    >
      {/* 终端容器 */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full overflow-hidden p-2 bg-[var(--color-bg-secondary)]"
        style={{
          minHeight: '200px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: '14px'
        }}
      />

      {/* 镜像拉取进度覆盖层 */}
      <ImagePullProgress />
      
      {/* 连接状态指示器 */}
      <ConnectionIndicator connected={isConnected} />
    </div>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
