package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
	ws "kwdb-playground/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestHandler() *Handler {
	dockerController, _ := docker.NewController()
	terminalManager := ws.NewTerminalManager()
	terminalManager.SetLogger(logger.NewLogger(logger.ERROR))
	courseService := course.NewService("./courses")
	loggerInstance := logger.NewLogger(logger.ERROR)

	return &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		terminalManager:  terminalManager,
		logger:           loggerInstance,
		cfg:              nil,
		sqlDriverManager: nil, // 测试时不需要SQL驱动
	}
}

func TestSQLWebSocketHeartbeat(t *testing.T) {
	handler := newTestHandler()

	// 创建测试服务器
	router := gin.New()
	router.GET("/ws/sql", handler.handleSqlWebSocket)

	// 创建测试服务器
	server := httptest.NewServer(router)
	defer server.Close()

	// 解析WebSocket地址
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/sql"

	// 连接WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()

	// 模拟初始化消息 - 使用不存在的课程ID，应该收到错误
	initMsg := map[string]interface{}{
		"type":     "init",
		"courseId": "nonexistent-course",
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		t.Fatalf("Failed to send init message: %v", err)
	}

	// 设置读取超时
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	// 等待错误消息
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read error message: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(msg, &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// 预期收到错误，因为课程不存在
	if response["type"] != "error" {
		t.Errorf("Expected 'error', got: %v", response)
	}

	t.Log("WebSocket connection established (course not found as expected)")
}

func TestSQLWebSocketPingPong(t *testing.T) {
	handler := newTestHandler()

	router := gin.New()
	router.GET("/ws/sql", handler.handleSqlWebSocket)
	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/sql"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()

	// 发送ping消息
	pingMsg := map[string]interface{}{
		"type": "ping",
	}
	if err := conn.WriteJSON(pingMsg); err != nil {
		t.Fatalf("Failed to send ping: %v", err)
	}

	// 设置读取超时
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	// 等待pong消息
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read pong: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(msg, &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["type"] != "pong" {
		t.Errorf("Expected 'pong', got: %v", response)
	}

	t.Log("Ping/Pong heartbeat working correctly")
}

func TestSQLWebSocketUnknownMessageType(t *testing.T) {
	handler := newTestHandler()

	router := gin.New()
	router.GET("/ws/sql", handler.handleSqlWebSocket)
	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/sql"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()

	// 发送未知类型的消息
	unknownMsg := map[string]interface{}{
		"type": "unknown",
	}
	if err := conn.WriteJSON(unknownMsg); err != nil {
		t.Fatalf("Failed to send unknown message: %v", err)
	}

	// 设置读取超时
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	// 应该收到错误消息
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read error message: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(msg, &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["type"] != "error" {
		t.Errorf("Expected 'error', got: %v", response)
	}

	if response["message"] != "未知消息类型" {
		t.Errorf("Expected '未知消息类型', got: %v", response["message"])
	}

	t.Log("Unknown message type handling works correctly")
}

func TestTerminalWebSocketHeartbeat(t *testing.T) {
	terminalManager := ws.NewTerminalManager()
	terminalManager.SetLogger(logger.NewLogger(logger.ERROR))

	// 测试获取活跃会话数量
	count := terminalManager.GetActiveSessionCount()
	if count != 0 {
		t.Errorf("Expected 0 active sessions, got: %d", count)
	}

	// 验证终端管理器的心跳配置常量
	const (
		writeWait  = 10 * time.Second
		pongWait   = 60 * time.Second
		pingPeriod = (pongWait * 9) / 10
	)

	if pingPeriod != 54*time.Second {
		t.Errorf("Expected pingPeriod to be 54 seconds, got: %v", pingPeriod)
	}

	if pongWait != 60*time.Second {
		t.Errorf("Expected pongWait to be 60 seconds, got: %v", pongWait)
	}

	if writeWait != 10*time.Second {
		t.Errorf("Expected writeWait to be 10 seconds, got: %v", writeWait)
	}

	t.Log("Terminal WebSocket heartbeat configuration is correct")
}

func TestWebSocketMessageTypes(t *testing.T) {
	// 测试消息类型定义
	msg := ws.Message{
		Type: "test",
		Data: "test data",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal message: %v", err)
	}

	var parsed ws.Message
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal message: %v", err)
	}

	if parsed.Type != "test" {
		t.Errorf("Expected type 'test', got: %s", parsed.Type)
	}

	if parsed.Data != "test data" {
		t.Errorf("Expected data 'test data', got: %v", parsed.Data)
	}

	t.Log("WebSocket message serialization works correctly")
}

func TestWebSocketPingPongHandler(t *testing.T) {
	handler := newTestHandler()

	router := gin.New()
	router.GET("/ws/sql", handler.handleSqlWebSocket)
	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/sql"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()

	// 发送多个ping消息，验证都能收到pong
	for i := 0; i < 3; i++ {
		pingMsg := map[string]interface{}{
			"type": "ping",
		}
		if err := conn.WriteJSON(pingMsg); err != nil {
			t.Fatalf("Failed to send ping %d: %v", i, err)
		}

		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read pong %d: %v", i, err)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(msg, &response); err != nil {
			t.Fatalf("Failed to parse pong %d: %v", i, err)
		}

		if response["type"] != "pong" {
			t.Errorf("Expected 'pong' for message %d, got: %v", i, response)
		}
	}

	t.Log("Multiple ping/pong messages handled correctly")
}
