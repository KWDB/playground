# internal/websocket - WebSocket Handlers

**Parent:** `/AGENTS.md`

## OVERVIEW

Terminal and SQL WebSocket handlers for interactive course sessions.

## FILES

```
websocket/
├── terminal.go   # Shell terminal WS (368 lines)
├── sql.go        # SQL execution WS
└── code.go       # Code execution WS (Python/Bash)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Terminal WS | terminal.go | xterm.js PTY, session lifecycle |
| SQL WS | sql.go | Query/result protocol |
| Code WS | code.go | Python/Bash execution via exec |

## ENDPOINTS

- `GET /ws/terminal?container_id=...&session_id=...`
- `GET /ws/sql?container_id=...&session_id=...`
- `GET /ws/code?container_id=...&session_id=...`

## ANTI-PATTERNS

- No ping/pong heartbeat (relies on TCP keepalive)
- Session cleanup on disconnect only
