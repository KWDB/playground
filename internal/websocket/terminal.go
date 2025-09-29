package websocket

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"

	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// Message WebSocket消息结构
type Message struct {
	Type string      `json:"type"`           // 消息类型: input, output, error, image_pull_progress
	Data interface{} `json:"data"`           // 消息数据，支持字符串和结构体
	Meta interface{} `json:"meta,omitempty"` // 额外的元数据，用于镜像拉取进度等
}

// 使用docker包中的ImagePullProgressMessage类型
type ImagePullProgressMessage = docker.ImagePullProgress

// TerminalSession 终端会话
type TerminalSession struct {
	sessionID   string
	containerID string
	conn        *websocket.Conn
	cmd         *exec.Cmd
	pty         *os.File
	ctx         context.Context
	cancel      context.CancelFunc
	logger      *logger.Logger // 日志记录器实例
}

// TerminalManager 终端管理器
type TerminalManager struct {
	sessions map[string]*TerminalSession
	mu       sync.RWMutex
	logger   *logger.Logger // 日志记录器实例
}

// NewTerminalManager 创建终端管理器
func NewTerminalManager() *TerminalManager {
	return &TerminalManager{
		sessions: make(map[string]*TerminalSession),
		logger:   logger.NewLogger(logger.INFO), // 默认INFO级别
	}
}

// SetLogger 设置日志记录器实例
// 允许外部配置logger，使其与配置系统兼容
func (tm *TerminalManager) SetLogger(loggerInstance *logger.Logger) {
	tm.logger = loggerInstance
}

// CreateSession 创建新的终端会话
func (tm *TerminalManager) CreateSession(sessionID, containerID string, conn *websocket.Conn) *TerminalSession {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// 清理已存在的会话
	if old, exists := tm.sessions[sessionID]; exists {
		old.Close()
		delete(tm.sessions, sessionID)
	}

	ctx, cancel := context.WithCancel(context.Background())
	session := &TerminalSession{
		sessionID:   sessionID,
		containerID: containerID,
		conn:        conn,
		ctx:         ctx,
		cancel:      cancel,
		logger:      tm.logger, // 传递logger实例
	}

	tm.sessions[sessionID] = session
	return session
}

// StartInteractiveSession 启动交互式终端会话 - 核心功能：docker exec -it /bin/bash
func (ts *TerminalSession) StartInteractiveSession() error {
	// 优先尝试使用 /bin/bash，不存在时回退到 /bin/sh，提升不同基础镜像的兼容性
	tryStart := func(shell string) (*exec.Cmd, *os.File, error) {
		cmd := exec.CommandContext(ts.ctx, "docker", "exec", "-it", ts.containerID, shell)
		ptyFile, err := pty.Start(cmd)
		if err != nil {
			return nil, nil, fmt.Errorf("启动伪终端失败(%s): %v", shell, err)
		}
		return cmd, ptyFile, nil
	}

	cmd, ptyFile, err := tryStart("/bin/bash")
	if err != nil {
		// 记录日志并尝试回退到 /bin/sh
		ts.logger.Warn("/bin/bash 不可用，尝试使用 /bin/sh，容器: %s，错误: %v", ts.containerID, err)
		cmd, ptyFile, err = tryStart("/bin/sh")
		if err != nil {
			// 两种Shell均失败，返回错误，让上层进行错误处理与反馈
			return fmt.Errorf("启动交互式终端失败(无可用Shell): %v", err)
		}
	}

	ts.cmd = cmd
	ts.pty = ptyFile

	// 发送连接成功消息给客户端
	connectedMsg := Message{
		Type: "connected",
		Data: "Terminal session started",
	}
	if err := ts.conn.WriteJSON(connectedMsg); err != nil {
		ts.logger.Error("发送连接确认消息失败: %v", err)
		// 不返回错误，继续执行
	}
	ts.logger.Debug("终端会话已启动，会话ID: %s", ts.sessionID)

	// 启动双向通信处理
	go ts.handleWebSocketInput() // 处理前端输入
	go ts.handleTerminalOutput() // 处理终端输出
	go ts.waitForTerminalExit()  // 等待终端退出

	return nil
}

// handleWebSocketInput 处理来自前端的输入
func (ts *TerminalSession) handleWebSocketInput() {
	for {
		select {
		case <-ts.ctx.Done():
			return
		default:
			var msg Message
			if err := ts.conn.ReadJSON(&msg); err != nil {
				// 正常关闭连接时不作为错误打印，减少噪声
				ts.logger.Debug("WebSocket连接结束或读取中断: %v", err)
				return
			}
			// 只处理输入类型的消息
			if msg.Type == "input" && ts.pty != nil {
				// 使用类型断言将interface{}转换为string，然后转换为[]byte
				if dataStr, ok := msg.Data.(string); ok {
					_, err := ts.pty.Write([]byte(dataStr))
					if err != nil {
						ts.logger.Warn("写入终端失败: %v", err)
						return
					}
				} else {
					ts.logger.Warn("消息数据类型错误，期望string类型")
				}
			}
		}
	}
}

// handleTerminalOutput 处理终端输出并发送到前端
func (ts *TerminalSession) handleTerminalOutput() {
	buf := make([]byte, 1024)
	for {
		select {
		case <-ts.ctx.Done():
			return
		default:
			n, err := ts.pty.Read(buf)
			if err != nil {
				if err != io.EOF {
					ts.logger.Error("读取终端输出失败: %v", err)
				}
				return
			}

			if n > 0 {
				msg := Message{
					Type: "output",
					Data: string(buf[:n]),
				}
				if err := ts.conn.WriteJSON(msg); err != nil {
					ts.logger.Error("发送输出到前端失败: %v", err)
					return
				}
			}
		}
	}
}

// waitForTerminalExit 等待终端命令退出
func (ts *TerminalSession) waitForTerminalExit() {
	if ts.cmd != nil {
		err := ts.cmd.Wait()
		if err != nil {
			ts.logger.Debug("终端命令退出: %v", err)
			msg := Message{
				Type: "error",
				Data: fmt.Sprintf("终端会话结束: %v", err),
			}
			ts.conn.WriteJSON(msg)
		}
	}
	ts.Close()
}

// Close 关闭终端会话
func (ts *TerminalSession) Close() {
	if ts.cancel != nil {
		ts.cancel()
	}
	if ts.pty != nil {
		ts.pty.Close()
	}
	if ts.conn != nil {
		ts.conn.Close()
	}
}

// Done 返回会话结束信号
func (ts *TerminalSession) Done() <-chan struct{} {
	return ts.ctx.Done()
}

// RemoveSession 从管理器中移除会话
func (tm *TerminalManager) RemoveSession(sessionID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	delete(tm.sessions, sessionID)
}

// BroadcastImagePullProgress 向所有活跃的WebSocket连接广播镜像拉取进度
func (tm *TerminalManager) BroadcastImagePullProgress(progress ImagePullProgressMessage) {
	tm.mu.RLock()
	activeSessions := make(map[string]*TerminalSession)
	for sessionID, session := range tm.sessions {
		activeSessions[sessionID] = session
	}
	tm.mu.RUnlock()

	// 详细日志记录：区分错误和正常进度消息
	isErrorMessage := progress.Error != ""
	isSuccessMessage := progress.Status == "拉取成功" || progress.Status == "Pull complete"
	isFatalError := isErrorMessage && (progress.Status == "拉取失败" ||
		progress.Status == "镜像不存在" ||
		progress.Status == "网络错误")

	if isFatalError {
		tm.logger.Error("镜像拉取致命错误 - 镜像: %s, 状态: %s, 错误: %s",
			progress.ImageName, progress.Status, progress.Error)
	} else if isErrorMessage {
		tm.logger.Warn("镜像拉取警告 - 镜像: %s, 状态: %s, 错误: %s",
			progress.ImageName, progress.Status, progress.Error)
	} else if isSuccessMessage {
		tm.logger.Info("镜像拉取成功 - 镜像: %s, 状态: %s",
			progress.ImageName, progress.Status)
	} else {
		tm.logger.Debug("镜像拉取进度 - 镜像: %s, 状态: %s, 进度: %s",
			progress.ImageName, progress.Status, progress.Progress)
	}

	msg := Message{
		Type: "image_pull_progress",
		Data: progress,
	}

	// 统计活跃会话数量
	activeSessionCount := len(activeSessions)
	successfulBroadcasts := 0
	failedBroadcasts := 0
	disconnectedSessions := []string{}

	// 向所有活跃的会话广播进度信息
	for sessionID, session := range activeSessions {
		select {
		case <-session.Done():
			// 会话已关闭，跳过并记录
			tm.logger.Debug("跳过已关闭的会话: %s", sessionID)
			disconnectedSessions = append(disconnectedSessions, sessionID)
			continue
		default:
			if session.conn != nil {
				if err := session.conn.WriteJSON(msg); err != nil {
					failedBroadcasts++
					tm.logger.Error("向会话 %s 发送镜像拉取进度失败: %v", sessionID, err)
					// 连接失败，标记为断开
					disconnectedSessions = append(disconnectedSessions, sessionID)
				} else {
					successfulBroadcasts++
					if isErrorMessage {
						tm.logger.Debug("错误消息已发送到会话: %s", sessionID)
					} else if isSuccessMessage {
						tm.logger.Debug("成功消息已发送到会话: %s", sessionID)
					}
				}
			} else {
				tm.logger.Warn("会话 %s 的连接为空", sessionID)
				disconnectedSessions = append(disconnectedSessions, sessionID)
			}
		}
	}

	// 清理断开的会话
	if len(disconnectedSessions) > 0 {
		go func() {
			for _, sessionID := range disconnectedSessions {
				tm.RemoveSession(sessionID)
			}
			tm.logger.Info("清理了 %d 个断开的会话", len(disconnectedSessions))
		}()
	}

	// 广播统计日志
	logLevel := "Info"
	if isFatalError {
		logLevel = "Error"
	} else if isErrorMessage {
		logLevel = "Warn"
	}

	tm.logger.Debug("镜像拉取进度广播完成 [%s] - 总会话: %d, 成功: %d, 失败: %d, 断开: %d, 错误类型: %v",
		logLevel, activeSessionCount, successfulBroadcasts, failedBroadcasts, len(disconnectedSessions), isFatalError)
}

// GetActiveSessionCount 获取活跃会话数量
func (tm *TerminalManager) GetActiveSessionCount() int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return len(tm.sessions)
}
