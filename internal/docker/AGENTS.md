# internal/docker - Container Orchestration

**Parent:** `/AGENTS.md`

## OVERVIEW

Docker SDK wrapper: container lifecycle (create/start/stop/pause/resume), image pulling, file injection, exec commands. **CRITICAL: 2316 lines, high concurrency.**

## KEY FILES

- `controller.go` (2316 lines) - Main Docker controller
- `adapter.go` - Docker client adapter
- `types.go` - Container/Image types

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Container start race | controller.go:StartContainer | Polling loops, mutex |
| Image pull | controller.go:PullImage | Progress callback |
| File injection | controller.go:CopyFilesToContainer | Map files to container |
| Exec command | controller.go:ExecCommandInteractive | Interactive exec |

## COMPLEXITY HOTSPOTS

- Per-course mutex map (`d.muMu sync.Mutex`)
- Container state caching (`isContainerRunningCached`)
- Polling loops with exponential backoff
- Container name/label parsing

## ANTI-PATTERNS

- Heavy mutex usage may cause contention
- No circuit breaker on Docker API calls
- Race conditions in status polling

## API ENDPOINTS USED

- `POST /api/courses/:id/start`
- `POST /api/courses/:id/stop`
- `POST /api/courses/:id/pause`
- `POST /api/courses/:id/resume`
- `GET /api/containers/:id/status`
- `GET /api/containers/:id/logs`
