# internal/websocket - WebSocket Handlers

**Parent:** `/AGENTS.md`

## OVERVIEW

Terminal and code execution WebSocket handlers for interactive course sessions. SQL handler lives in `internal/api/handlers_sql_ws.go`.

## FILES

| File | Lines | Purpose |
|------|-------|---------|
| terminal.go | 368 | xterm.js PTY, shell interaction |
| code.go | 382 | Python/Bash/Node code execution |
| terminal_test.go | - | Session tests |

## ENDPOINTS

| Handler | Endpoint | Purpose |
|---------|----------|---------|
| terminal.go | `/ws/terminal?container_id=&session_id=` | Interactive shell |
| code.go | `/ws/code?container_id=&session_id=` | Code execution |
| SQL WS | `/ws/sql` (in api/) | SQL queries |

## MESSAGE PROTOCOL

### Terminal Messages
| Type | Dir | Data |
|------|-----|------|
| `input` | → | keystrokes (string) |
| `output` | ← | terminal output |
| `resize` | → | `{"cols", "rows"}` |
| `ping`/`pong` | ↔ | heartbeat |
| `connected` | ← | session started |
| `image_pull_progress` | ← | mirror pull status |

### Code Messages
| Type | Dir | Data |
|------|-----|------|
| `execute` | → | `{"containerId", "language", "code", "timeout"}` |
| `cancel` | → | `{"executionId"}` |
| `output` | ← | stdout/stderr |
| `error` | ← | error message |
| `done` | ← | `{"executionId", "output", "exitCode", "duration"}` |

## TIMING CONSTANTS

```go
writeWait   = 10 * time.Second   // write deadline
pongWait    = 60 * time.Second   // read deadline before pong
pingPeriod  = 54 * time.Second   // (pongWait * 9) / 10
maxMessageSize = 8192            // bytes
```

## ARCHITECTURE

### Write Pump (Exclusive Writer)
Single goroutine owns all WebSocket writes via `sendCh` channel. Eliminates concurrent write races.

### Thread-Safe Send
```go
func (ts *TerminalSession) Send(msg Message) {
    select {
    case ts.sendCh <- msg:  // non-blocking send
    case <-ts.ctx.Done():
    }
}
```

### Context Cancellation Chain
`ctx.Done()` cascades to: writePump, input handler, output handler, exit waiter.

### CRITICAL ANTI-PATTERN
**Do NOT close `conn` in handler.** writePump closes conn on `ctx.Done()`. Close sequence: `Close()` → `cancel()` → ctx done → writePump exits → conn closed.

## ERROR CLASSIFICATION

| Condition | Action |
|-----------|--------|
| `IsUnexpectedCloseError` | session cleanup |
| `ReadJSON` timeout | reconnect |
| exec Reader EOF | graceful close |
| Write failure | abort pump |
