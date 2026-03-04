# internal/api - HTTP Handlers

**Parent:** `/AGENTS.md`

## OVERVIEW

Gin HTTP handlers for courses, containers, images, progress, WebSocket terminals. **CRITICAL: 2151 lines.**

## KEY FILES

- `routes.go` (2151 lines) - All HTTP handler
- Handler struct wires: course service, docker controller, terminal manager

## WHERE TO LOOK

| Handler | Function | Risk |
|---------|----------|------|
| Start course | startCourse | Multi-step, error cleanup |
| Terminal WS | handleTerminalWebSocket | WS upgrade, message parsing |
| SQL WS | handleSqlWebSocket | Query/result protocol |
| Code WS | handleCodeWebSocket | Code execution protocol |
| Port conflict | checkPortConflict | Endpoint compatibility |

## KNOWN ISSUES

1. Long handlers with layered error handling

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
  POST   /api/containers/:id/restart
  POST   /api/containers/:id/stop
  POST   /api/containers/:id/pause
  POST   /api/containers/:id/unpause

Progress:
  GET    /api/progress/:courseId
  POST   /api/progress/:courseId/save
  POST   /api/progress/:courseId/reset

WebSocket:
  GET    /ws/terminal
  GET    /ws/sql
  GET    /ws/code

System:
  GET    /health
  GET    /api/version
  GET    /api/env-check

Upgrade:
  POST   /api/upgrade
  GET    /api/check-upgrade
  POST   /api/upgrade-docker

Images:
  GET    /api/images/:name/check
  GET    /api/images/sources

SQL:
  GET    /api/sql/info
  GET    /api/sql/health
```
