package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"

	"github.com/gorilla/websocket"
)

const (
	// Default code execution timeout
	defaultCodeTimeout = 30 * time.Second
)

// CodeMessage WebSocket消息结构（代码执行）
type CodeMessage struct {
	Type      string          `json:"type"`                // 消息类型: execute, input, cancel
	Data      json.RawMessage `json:"data"`                // 消息数据
	SessionID string          `json:"sessionId,omitempty"` // 会话ID
}

// ExecuteRequest 执行请求数据
type ExecuteRequest struct {
	ContainerID string `json:"containerId"` // 容器ID
	Language    string `json:"language"`    // 语言: python, bash, node
	Code        string `json:"code"`        // 要执行的代码
	Timeout     int    `json:"timeout"`     // 超时时间（秒），0表示使用默认值
}

// InputRequest 输入请求数据
type InputRequest struct {
	Input string `json:"input"` // 输入数据
}

// CancelRequest 取消请求数据
type CancelRequest struct {
	ExecutionID string `json:"executionId"` // 要取消的执行ID
}

// CodeResponse 执行响应数据
type CodeResponse struct {
	Type        string `json:"type"`               // 响应类型: output, error, done
	ExecutionID string `json:"executionId"`        // 执行ID
	Output      string `json:"output,omitempty"`   // 输出内容
	Error       string `json:"error,omitempty"`    // 错误信息
	ExitCode    int    `json:"exitCode,omitempty"` // 退出码
	Duration    int64  `json:"duration,omitempty"` // 执行时长（毫秒）
}

// CodeSession 代码执行会话
type CodeSession struct {
	sessionID  string
	conn       *websocket.Conn
	dockerCtrl docker.Controller
	ctx        context.Context
	cancel     context.CancelFunc
	logger     *logger.Logger
	sendCh     chan CodeResponse
	mu         sync.Mutex
	running    bool
}

// CodeManager 代码执行管理器
type CodeManager struct {
	sessions map[string]*CodeSession
	mu       sync.RWMutex
	logger   *logger.Logger
}

// NewCodeManager 创建代码执行管理器
func NewCodeManager() *CodeManager {
	return &CodeManager{
		sessions: make(map[string]*CodeSession),
		logger:   logger.NewLogger(logger.INFO),
	}
}

// SetLogger 设置日志记录器实例
func (cm *CodeManager) SetLogger(loggerInstance *logger.Logger) {
	cm.logger = loggerInstance
}

// CreateSession 创建新的代码执行会话
func (cm *CodeManager) CreateSession(sessionID string, conn *websocket.Conn, dockerCtrl docker.Controller) *CodeSession {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// 清理已存在的会话
	if old, exists := cm.sessions[sessionID]; exists {
		old.Close()
		delete(cm.sessions, sessionID)
	}

	ctx, cancel := context.WithCancel(context.Background())
	session := &CodeSession{
		sessionID:  sessionID,
		conn:       conn,
		dockerCtrl: dockerCtrl,
		ctx:        ctx,
		cancel:     cancel,
		logger:     cm.logger,
		sendCh:     make(chan CodeResponse, 256),
	}

	cm.sessions[sessionID] = session
	return session
}

// RemoveSession 从管理器中移除会话
func (cm *CodeManager) RemoveSession(sessionID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if session, exists := cm.sessions[sessionID]; exists {
		session.Close()
		delete(cm.sessions, sessionID)
	}
}

// GetSession 获取会话
func (cm *CodeManager) GetSession(sessionID string) *CodeSession {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.sessions[sessionID]
}

// SetLogger 设置会话的日志记录器
func (cs *CodeSession) SetLogger(loggerInstance *logger.Logger) {
	cs.logger = loggerInstance
}

// StartSession 启动代码执行会话
func (cs *CodeSession) StartSession() error {
	cs.logger.Info("代码执行会话已启动，会话ID: %s", cs.sessionID)

	// 启动写入泵
	go cs.writePump()

	// 处理客户端消息
	go cs.handleMessages()

	return nil
}

// writePump 将消息从Hub发送到WebSocket连接
func (cs *CodeSession) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		cs.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-cs.sendCh:
			cs.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				cs.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := cs.conn.WriteJSON(msg); err != nil {
				cs.logger.Error("写入WebSocket失败: %v", err)
				return
			}

		case <-ticker.C:
			cs.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := cs.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-cs.ctx.Done():
			return
		}
	}
}

// handleMessages 处理来自客户端的消息
func (cs *CodeSession) handleMessages() {
	defer func() {
		cs.Close()
	}()

	cs.conn.SetReadLimit(maxMessageSize)
	cs.conn.SetReadDeadline(time.Now().Add(pongWait))
	cs.conn.SetPongHandler(func(string) error {
		cs.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		select {
		case <-cs.ctx.Done():
			return
		default:
			var msg CodeMessage
			if err := cs.conn.ReadJSON(&msg); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					cs.logger.Error("WebSocket读取错误: %v", err)
				}
				return
			}

			// 重置读取截止时间
			cs.conn.SetReadDeadline(time.Now().Add(pongWait))

			// 处理心跳
			if msg.Type == "ping" {
				cs.sendCh <- CodeResponse{Type: "pong"}
				continue
			}

			// 处理执行请求
			if msg.Type == "execute" {
				cs.handleExecute(msg.Data)
				continue
			}

			// 处理取消请求
			if msg.Type == "cancel" {
				cs.handleCancel(msg.Data)
				continue
			}

			// 处理输入请求（暂不支持非交互式执行）
			if msg.Type == "input" {
				cs.sendCh <- CodeResponse{
					Type:  "error",
					Error: "input not supported for non-interactive execution",
				}
				continue
			}
		}
	}
}

// handleExecute 处理代码执行请求
func (cs *CodeSession) handleExecute(data json.RawMessage) {
	var req ExecuteRequest
	if err := json.Unmarshal(data, &req); err != nil {
		cs.sendCh <- CodeResponse{
			Type:  "error",
			Error: fmt.Sprintf("invalid execute request: %v", err),
		}
		return
	}

	if req.ContainerID == "" {
		cs.sendCh <- CodeResponse{
			Type:  "error",
			Error: "container ID is required",
		}
		return
	}

	if req.Code == "" {
		cs.sendCh <- CodeResponse{
			Type:  "error",
			Error: "code is required",
		}
		return
	}

	// 生成执行ID
	executionID := fmt.Sprintf("exec_%d", time.Now().UnixNano())

	// 设置超时
	timeout := time.Duration(req.Timeout) * time.Second
	if timeout <= 0 {
		timeout = defaultCodeTimeout
	}

	cs.logger.Info("开始执行代码，会话: %s, 容器: %s, 语言: %s", cs.sessionID, req.ContainerID, req.Language)

	// 标记为运行中
	cs.mu.Lock()
	cs.running = true
	cs.mu.Unlock()

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(cs.ctx, timeout)
	defer cancel()

	// 执行代码
	startTime := time.Now()
	result, err := cs.dockerCtrl.ExecCode(ctx, req.ContainerID, &docker.ExecCodeOptions{
		Language: docker.CodeLanguage(req.Language),
		Code:     req.Code,
		Timeout:  timeout,
	})

	duration := time.Since(startTime).Milliseconds()

	// 标记为未运行
	cs.mu.Lock()
	cs.running = false
	cs.mu.Unlock()

	if err != nil {
		cs.sendCh <- CodeResponse{
			Type:        "error",
			ExecutionID: executionID,
			Error:       fmt.Sprintf("execution failed: %v", err),
			Duration:    duration,
		}
		cs.logger.Error("代码执行失败: %v", err)
		return
	}

	// 发送执行结果
	response := CodeResponse{
		Type:        "done",
		ExecutionID: executionID,
		Output:      result.Stdout,
		Error:       result.Stderr,
		ExitCode:    result.ExitCode,
		Duration:    duration,
	}

	if result.Error != "" {
		response.Error = result.Error
	}

	cs.sendCh <- response
	cs.logger.Info("代码执行完成，容器: %s, 退出码: %d, 耗时: %dms", req.ContainerID, result.ExitCode, duration)
}

// handleCancel 处理取消请求
func (cs *CodeSession) handleCancel(data json.RawMessage) {
	var req CancelRequest
	if err := json.Unmarshal(data, &req); err != nil {
		cs.sendCh <- CodeResponse{
			Type:  "error",
			Error: fmt.Sprintf("invalid cancel request: %v", err),
		}
		return
	}

	cs.mu.Lock()
	defer cs.mu.Unlock()

	if cs.running {
		cs.cancel()
		cs.running = false
		cs.sendCh <- CodeResponse{
			Type:        "done",
			ExecutionID: req.ExecutionID,
			Error:       "execution cancelled",
		}
		cs.logger.Info("代码执行已取消，会话: %s", cs.sessionID)
	}
}

// Close 关闭代码执行会话
func (cs *CodeSession) Close() {
	if cs.ctx.Err() != nil {
		return
	}

	cs.cancel()

	// 关闭发送通道
	close(cs.sendCh)
}

// Done 返回会话结束信号
func (cs *CodeSession) Done() <-chan struct{} {
	return cs.ctx.Done()
}

// IsRunning 检查是否有正在执行的代码
func (cs *CodeSession) IsRunning() bool {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	return cs.running
}
