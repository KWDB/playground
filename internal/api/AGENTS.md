# internal/api - HTTP Handlers

**Parent:** `/AGENTS.md`

## OVERVIEW

Gin HTTP handlers for courses, containers, images, progress, WebSocket terminals. **CRITICAL: 2151 lines.**

## KEY FILES

- `routes.go` (2151 lines) - All HTTP handlers
- Handler struct wires: course service, docker controller, terminal manager

## WHERE TO LOOK

| Handler | Function | Risk |
|---------|----------|------|
| Start course | startCourse | Multi-step, error cleanup |
| Terminal WS | handleTerminalWebSocket | WS upgrade, message parsing |
| SQL WS | handleSqlWebSocket | Query/result protocol |
| Port conflict | checkPortConflict | Path mismatch w/ frontend |

## KNOWN ISSUES

1. **Route mismatch**: Frontend calls `/port-conflict`, backend has `/check-port-conflict`
2. **Cleanup mismatch**: Frontend calls `/containers/cleanup`, backend has `/courses/:id/cleanup-containers`
3. Long handlers with layered error handling

## ENDPOINTS

```
Courses:
  GET    /api/courses
  GET    /api/courses/:id
  POST   /api/courses/:id/start
  POST   /api/courses/:id/stop
  POST   /api/courses/:id/pause
  POST   /api/courses/:id/resume
  POST   /api/courses/:id/cleanup-containers
  GET    /api/courses/:id/check-port-conflict

Containers:
  GET    /api/containers/:id/status
  GET    /api/containers/:id/logs
  DELETE /api/containers/:id
  POST   /api/containers/cleanup

Progress:
  GET    /api/progress/:courseId
  POST   /api/progress/:courseId/save
  POST   /api/progress/:courseId/reset

WebSocket:
  GET    /ws/terminal
  GET    /ws/sql
```
