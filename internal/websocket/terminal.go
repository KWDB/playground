package websocket

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// Message WebSocket消息结构 - 最小化设计
type Message struct {
	Type string `json:"type"` // 消息类型: input, output, error
	Data string `json:"data"` // 消息数据
}

// TerminalSession 终端会话 - 专注于docker exec -it /bin/bash
type TerminalSession struct {
	sessionID   string
	containerID string
	conn        *websocket.Conn
	cmd         *exec.Cmd
	pty         *os.File
	ctx         context.Context
	cancel      context.CancelFunc
}

// TerminalManager 终端管理器
type TerminalManager struct {
	sessions map[string]*TerminalSession
	mu       sync.RWMutex
}

// NewTerminalManager 创建终端管理器
func NewTerminalManager() *TerminalManager {
	return &TerminalManager{
		sessions: make(map[string]*TerminalSession),
	}
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
	}

	tm.sessions[sessionID] = session
	return session
}

// StartInteractiveSession 启动交互式终端会话 - 核心功能：docker exec -it /bin/bash
func (ts *TerminalSession) StartInteractiveSession() error {
	// 创建docker exec命令，直接进入bash交互式终端
	cmd := exec.CommandContext(ts.ctx, "docker", "exec", "-it", ts.containerID, "/bin/bash")

	// 创建伪终端以支持交互式操作
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("启动伪终端失败: %v", err)
	}

	ts.cmd = cmd
	ts.pty = ptyFile

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
				log.Printf("读取WebSocket消息失败: %v", err)
				return
			}

			// 只处理输入类型的消息
			if msg.Type == "input" && ts.pty != nil {
				_, err := ts.pty.Write([]byte(msg.Data))
				if err != nil {
					log.Printf("写入终端失败: %v", err)
					return
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
					log.Printf("读取终端输出失败: %v", err)
				}
				return
			}

			if n > 0 {
				msg := Message{
					Type: "output",
					Data: string(buf[:n]),
				}
				if err := ts.conn.WriteJSON(msg); err != nil {
					log.Printf("发送输出到前端失败: %v", err)
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
			log.Printf("终端命令退出: %v", err)
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
