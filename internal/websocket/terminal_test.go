package websocket

import (
	"testing"

	"kwdb-playground/internal/logger"
)

func TestNewTerminalManager(t *testing.T) {
	tm := NewTerminalManager()
	if tm == nil {
		t.Fatal("NewTerminalManager should return non-nil TerminalManager")
	}

	if tm.sessions == nil {
		t.Error("sessions map should be initialized")
	}

	count := tm.GetActiveSessionCount()
	if count != 0 {
		t.Errorf("Expected 0 active sessions, got: %d", count)
	}
}

func TestTerminalManager_SetLogger(t *testing.T) {
	tm := NewTerminalManager()
	loggerInstance := logger.NewLogger(logger.ERROR)

	tm.SetLogger(loggerInstance)

	if tm.logger != loggerInstance {
		t.Error("logger should be set")
	}
}

func TestTerminalManager_CreateSession(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	session := tm.CreateSession("session-123", "container-abc", nil, nil)
	if session == nil {
		t.Fatal("CreateSession should return non-nil session")
	}

	if session.sessionID != "session-123" {
		t.Errorf("Expected sessionID 'session-123', got: %s", session.sessionID)
	}

	if session.containerID != "container-abc" {
		t.Errorf("Expected containerID 'container-abc', got: %s", session.containerID)
	}

	count := tm.GetActiveSessionCount()
	if count != 1 {
		t.Errorf("Expected 1 active session, got: %d", count)
	}
}

func TestTerminalManager_RemoveSession(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	tm.CreateSession("session-123", "container-abc", nil, nil)

	tm.RemoveSession("session-123")

	count := tm.GetActiveSessionCount()
	if count != 0 {
		t.Errorf("Expected 0 active sessions after removal, got: %d", count)
	}
}

func TestTerminalManager_RemoveSession_NotFound(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	tm.RemoveSession("nonexistent-session")
}

func TestTerminalManager_CreateSession_ReplacesExisting(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	tm.CreateSession("session-123", "container-1", nil, nil)
	tm.CreateSession("session-123", "container-2", nil, nil)

	count := tm.GetActiveSessionCount()
	if count != 1 {
		t.Errorf("Expected 1 active session (replaced), got: %d", count)
	}

	tm.mu.RLock()
	session := tm.sessions["session-123"]
	tm.mu.RUnlock()

	if session.containerID != "container-2" {
		t.Errorf("Expected containerID 'container-2', got: %s", session.containerID)
	}
}

func TestTerminalManager_GetActiveSessionCount(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	count := tm.GetActiveSessionCount()
	if count != 0 {
		t.Errorf("Expected 0, got: %d", count)
	}

	tm.CreateSession("session-1", "container-1", nil, nil)
	count = tm.GetActiveSessionCount()
	if count != 1 {
		t.Errorf("Expected 1, got: %d", count)
	}

	tm.CreateSession("session-2", "container-2", nil, nil)
	count = tm.GetActiveSessionCount()
	if count != 2 {
		t.Errorf("Expected 2, got: %d", count)
	}

	tm.RemoveSession("session-1")
	count = tm.GetActiveSessionCount()
	if count != 1 {
		t.Errorf("Expected 1, got: %d", count)
	}
}

func TestTerminalManager_ConcurrentAccess(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		go func(idx int) {
			tm.CreateSession("session-"+string(rune('0'+idx)), "container-1", nil, nil)
			_ = tm.GetActiveSessionCount()
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	count := tm.GetActiveSessionCount()
	if count != 10 {
		t.Errorf("Expected 10 sessions, got: %d", count)
	}
}

func TestMessage_Type(t *testing.T) {
	msg := Message{
		Type: "test",
		Data: "test data",
	}

	if msg.Type != "test" {
		t.Errorf("Expected Type 'test', got: %s", msg.Type)
	}

	if msg.Data != "test data" {
		t.Errorf("Expected Data 'test data', got: %v", msg.Data)
	}
}

func TestMessage_WithMeta(t *testing.T) {
	metaData := map[string]int{"progress": 50}
	msg := Message{
		Type: "progress",
		Data: "downloading",
		Meta: metaData,
	}

	if msg.Type != "progress" {
		t.Errorf("Expected Type 'progress', got: %s", msg.Type)
	}

	if msg.Meta == nil {
		t.Error("Meta should not be nil")
	}
}

func TestTerminalSession_Fields(t *testing.T) {
	tm := NewTerminalManager()
	tm.SetLogger(logger.NewLogger(logger.ERROR))

	session := tm.CreateSession("sess-001", "cont-xyz", nil, nil)

	if session.sessionID != "sess-001" {
		t.Errorf("Expected sessionID 'sess-001', got: %s", session.sessionID)
	}

	if session.containerID != "cont-xyz" {
		t.Errorf("Expected containerID 'cont-xyz', got: %s", session.containerID)
	}

	if session.conn != nil {
		t.Error("conn should be nil for this test")
	}

	if session.ctx == nil {
		t.Error("ctx should be initialized")
	}

	if session.cancel == nil {
		t.Error("cancel should be initialized")
	}

	if session.logger == nil {
		t.Error("logger should be inherited from manager")
	}
}
