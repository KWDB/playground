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
// 更精确的容器状态类型，便于类型收敛与代码可读性
/** 容器生命周期状态，驱动终端 WS 连接策略与进度显示 */
export type ContainerStatus = 'running' | 'starting' | 'stopping' | 'stopped' | 'exited' | 'completed' | 'unknown' | 'error';

/** Terminal 组件入参：通过 containerId 与 containerStatus 控制连接与显示 */
interface TerminalProps {
  containerId?: string; // 可选：支持容器启动过程中的显示
  containerStatus?: ContainerStatus; // 容器状态：控制WS连接策略与进度连接
}

// 终端引用接口
/** Terminal 暴露的外部方法，供父组件向容器终端发送命令 */
export interface TerminalRef {
  sendCommand: (command: string) => void;
  focus: () => void;
}

/** XTerm 终端组件：管理容器命令 WebSocket 与镜像进度 WebSocket，提供 sendCommand 能力 */
const Terminal = forwardRef<TerminalRef, TerminalProps>(({ containerId, containerStatus }, ref) => {
  // 引用和状态管理
  const xtermRef = useRef<XTerm | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // 进度专用 WebSocket 引用，在容器ID未就绪时也能接收镜像拉取进度
  const wsProgressRef = useRef<WebSocket | null>(null);
  // 重连定时器引用：用于在状态切换（例如停止）时取消已排队的重连
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null); // 心跳定时器
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // 记录上一次的进度与状态，减少终端内重复输出，避免闪烁
  const lastProgressRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string>('');
  const wsContainerIdRef = useRef<string | null>(null); // 记录当前 WebSocket 连接的容器 ID
  const debounceTimeoutRef = useRef<number | null>(null);
  
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const [imagePullProgress, setImagePullProgress] = useState<ImagePullProgressMessage | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // 防抖函数用于窗口大小调整（浏览器友好类型）
  /** 简单防抖：适配浏览器定时器类型，避免频繁 resize 导致布局抖动 */
const debounce = useCallback(<T extends (...args: unknown[]) => void>(func: T, wait: number) => {
    return (...args: Parameters<T>) => {
      const tid = debounceTimeoutRef.current;
      if (tid !== null) {
        clearTimeout(tid);
      }
      debounceTimeoutRef.current = window.setTimeout(() => {
        func(...args);
        debounceTimeoutRef.current = null; // 执行后清空，确保下一轮正常工作
      }, wait);
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
            data: {
              cols,
              rows
            }
          }));
        }
      } catch (error) {
        console.warn('调整终端大小失败:', error);
      }
    }
  }, []);

  // 防抖的调整大小函数
  const debouncedResize = useMemo(() => debounce(resizeTerminal, 150), [resizeTerminal, debounce]);

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

  // 智能换行处理函数
  const smartWrapCommand = useCallback((text: string, startX: number, cols: number): string => {
    // 如果文本包含换行符，说明可能是多行粘贴或脚本，不做处理以防破坏格式
    if (text.includes('\r') || text.includes('\n')) {
      return text;
    }

    // 按空格分割单词，保留空格信息以便重建
    // 使用正则 split 捕获分隔符
    const parts = text.split(/(\s+)/);
    let result = '';
    let currentX = startX;
    let inSingleQuote = false; // 追踪单引号状态，防止破坏 Shell 单引号字符串语义

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // 如果是空字符串，跳过
      if (!part) continue;

      // 简单计算 part 中单引号的数量，用于更新状态
      // Shell 中单引号内不能转义单引号，所以直接计数即可
      const quoteCount = (part.match(/'/g) || []).length;

      // 如果是空白符（空格、制表符等），直接追加并更新坐标
      if (/^\s+$/.test(part)) {
        result += part;
        currentX += part.length;
        continue;
      }

      // 如果是单词（包括 URL、参数、${VAR} 等）
      const wordLen = part.length;

      // 检查是否需要换行
      // 条件：
      // 1. 当前位置 + 单词长度 超过行宽
      // 2. 不是行首（避免死循环）
      // 3. 不在单引号内（单引号内插入续行符 \ 会改变字符串内容）
      if (!inSingleQuote && currentX + wordLen > cols && currentX > 0) {
        // 插入续行符和回车
        // 注意：Shell 中续行通常是 " \" 后跟回车
        result += ' \\\r'; 
        currentX = 0; // 换行后光标归零
        
        // 在新行追加单词
        result += part;
        currentX += wordLen;
      } else {
        // 不需要换行或不能换行，直接追加
        result += part;
        currentX += wordLen;
      }

      // 更新单引号状态
      if (quoteCount % 2 !== 0) {
        inSingleQuote = !inSingleQuote;
      }

      // 处理边界情况：如果 currentX 超过 cols（因为单词超长），shell 会自动 wrap
      // 我们需要更新 currentX 以反映 wrap 后的位置
      if (currentX >= cols) {
        currentX = currentX % cols;
      }
    }

    return result;
  }, []);

  // 统一处理镜像拉取进度（终端输出与覆盖层显示）
  /** 统一处理镜像拉取进度：更新覆盖层并可选输出到终端，成功/失败后自动隐藏 */
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

  // WebSocket连接管理函数
  const connectWebSocket = useCallback(() => {
    if (!containerId || !xtermRef.current) return;

    // 优化：如果连接已建立或正在建立，且容器ID未变，跳过重复连接
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      if (wsContainerIdRef.current === containerId) {
        return;
      }
    }

    // 关闭现有连接
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // 清理旧的心跳定时器
    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;

    const connect = () => {
      // 额外守卫：避免在容器非运行、页面不可见或ID缺失时发起新的连接
      // 注意：移除了 document.visibilityState === 'hidden' 的检查，允许后台重连，或者至少保持重连逻辑不被立即打断
      // 但通常浏览器在后台会限制资源，所以可以保留 visible 检查，但需配合 visibilitychange 事件恢复
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
          
          // 启动心跳检测
          if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000); // 每30秒发送一次心跳

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
              handleImagePullProgress(payload, true);
            } else if (msg.type === 'pong') {
              // 收到服务端心跳响应，连接健康
              // console.debug('Pong received');
            } else if (msg.type === 'connected') {
              // 连接成功消息
              if (xtermRef.current) {
                xtermRef.current.write('\r\n\x1b[32m✓ 终端已连接\x1b[0m\r\n');
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
          
          if (pingIntervalRef.current) {
            window.clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          
          if (xtermRef.current) {
            // 只有非正常关闭才显示断开提示，避免干扰用户体验
            if (!event.wasClean) {
                xtermRef.current.write('\r\n\x1b[33m连接已断开\x1b[0m\r\n');
            }
          }
          
          // 守卫：如果容器ID缺失或容器非运行状态，则不再重连
          // 移除了 visibilityState 的检查，确保即使用户切走也能尝试重连（虽然可能受限）
          // 但更重要，当用户切回来时，onVisibilityChange 会触发 connectWebSocket
          const shouldStopReconnect = !containerId || containerStatus !== 'running';
          if (shouldStopReconnect) {
            return;
          }
          
          // 实现指数退避重连策略
          if (reconnectAttempts < maxReconnectAttempts) {
            if (!event.wasClean) {
                const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
                console.log(`${delay}ms 后尝试重连 (第 ${reconnectAttempts + 1} 次)`);
                
                // 记录重连定时器，以便在状态变化时取消
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
          // onerror 后通常会触发 onclose，重连逻辑在 onclose 处理
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
  }, [containerId, containerStatus, handleImagePullProgress]);

  // 进度专用 WebSocket 连接（progress_only=true），用于容器启动阶段接收镜像拉取进度
  const connectProgressOnly = useCallback(() => {
    // 仅在容器启动阶段建立进度连接
    if (containerStatus !== 'starting') return;

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
            handleImagePullProgress(payload, false); // 仅覆盖层显示，不输出到终端
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

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建终端实例 - 优化配置以确保输入正常工作
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      // 关键修复：通过 xterm 选项控制行高，避免继承容器样式导致测量偏差
      // 当父容器设置了行高或字间距，xterm 的单元格尺寸计算会不一致，触发最后一行覆盖/重叠
      lineHeight: 1,
      // Dracula 主题：更高的前景对比度与友好的 ANSI 颜色
      theme: {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        black: '#21222C',
        red: '#FF5555',
        green: '#50FA7B',
        yellow: '#F1FA8C',
        blue: '#BD93F9',
        magenta: '#FF79C6',
        cyan: '#8BE9FD',
        white: '#F8F8F2',
        brightBlack: '#6272A4',
        brightRed: '#FF6E6E',
        brightGreen: '#69FF94',
        brightYellow: '#FFFFA5',
        brightBlue: '#D6ACFF',
        brightMagenta: '#FF92DF',
        brightCyan: '#A4FFFF',
        brightWhite: '#FFFFFF'
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
        // 智能换行处理：仅针对长文本粘贴（长度>40且无换行），避免破坏常规输入或多行粘贴
        let inputData = data;
        if (data.length > 40 && !data.includes('\r') && !data.includes('\n') && xtermRef.current) {
           const cursorX = xtermRef.current.buffer.active.cursorX;
           const cols = xtermRef.current.cols;
           // 应用智能换行算法
           inputData = smartWrapCommand(data, cursorX, cols);
        }

        const message = {
          type: 'input',
          data: inputData
        };
        wsRef.current.send(JSON.stringify(message));
      }
    });

    // 初始调整大小
    setTimeout(() => {
      // 使用 resizeTerminal 替代直接调用 fit，确保初始尺寸同步到后端
      resizeTerminal();
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
    sendCommand,
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus();
        setIsFocused(true);
        // 短暂的视觉反馈，可以根据需要调整
        setTimeout(() => setIsFocused(false), 300);
      }
    }
  }), [sendCommand]);

  // 组件卸载时的清理 - 独立于状态变化的 Effect
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

  // WebSocket连接管理：根据容器状态 + 页面可见性
  useEffect(() => {
    console.log('Terminal connection effect triggered:', { containerId, containerStatus });
    
    /** 按容器状态建立/清理 WS 连接；在页面可见性变化时协同处理重连 */
    const connectByStatus = () => {
      const isRunning = containerStatus === 'running';
      const isStarting = containerStatus === 'starting';

      if (isRunning && containerId && xtermRef.current) {
        // 容器运行中：使用终端连接
        // connectWebSocket 内部已包含防重复连接检查 (检查 wsContainerIdRef)
        connectWebSocket();
        
        // 关闭进度专用连接，避免双连接
        if (wsProgressRef.current) {
          wsProgressRef.current.close();
          wsProgressRef.current = null;
        }
      } else if (isStarting) {
        // 容器启动中：建立进度专用连接以接收镜像拉取进度
        connectProgressOnly();
        
        // 如果有终端连接，可以保持或关闭？通常启动中不应有终端连接
        if (wsRef.current && wsContainerIdRef.current !== containerId) {
             // 如果ID变了，或者不应该连接，则关闭
             wsRef.current.close();
             wsRef.current = null;
             wsContainerIdRef.current = null;
        }
      } else {
        // 其他状态（stopped/exited/undefined）：确保关闭所有连接并隐藏进度
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

    // 首次连接
    connectByStatus();

    // 页面可见性变化时守卫
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page visible, checking connection...');
        // 页面恢复可见时，检查并恢复连接（如果断开了）
        connectByStatus();
      }
      // 页面隐藏时不再主动断开连接
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // 注意：不再在此处关闭连接！
      // 连接关闭由 connectByStatus 在状态变化时处理，或由组件卸载 Effect 处理
      // 这样可以防止依赖变化导致的 Effect 重运行意外切断连接
    };
  }, [containerId, containerStatus, connectWebSocket, connectProgressOnly]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  // 保留原用法：包装为无 props 组件，内部传递状态
  const ImagePullProgress = () => (
    <ImagePullProgressOverlay show={showProgress} imagePullProgress={imagePullProgress} />
  );

  return (
    // 外层容器：采用 Dracula 配色背景、圆角与阴影增强质感；保留现有功能结构不变
    <div 
      className={`relative w-full h-full flex flex-col bg-[#282a36] rounded-xl shadow-2xl terminal-glow p-2 md:p-3 transition-all duration-200 ${
        isFocused ? 'ring-2 ring-blue-500/30' : ''
      }`} 
      role="region" 
      aria-label="Shell 终端"
    >
      {/* 终端容器 - 优化布局以防止文本重叠 */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full overflow-hidden terminal-font"
        style={{
          minHeight: '200px',
          // 重要：禁用容器级行高与字间距，避免 xterm 行测量偏差导致最后一行重叠
          // 字体与字号由 xterm 选项控制，容器不再覆盖，确保测量一致
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

export default Terminal;