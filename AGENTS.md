# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-02
**Commit:** 21d0029
**Branch:** feat/python-courses

## OVERVIEW

Full-stack interactive learning platform: Go 1.24 backend (Gin, Docker SDK, WebSocket) + React 18 frontend (TypeScript, Vite, Tailwind). Runs isolated Docker containers for hands-on courses.

## Quick Commands

| Task | Command |
|------|---------|
| Install deps | `make install` |
| Dev server | `make dev` |
| Run all Go tests | `go test ./...` |
| Run all E2E tests | `make e2e-playwright` |
| Build release | `make release` |

## Project Structure

```
.
├── cmd/                # Main applications
├── internal/           # Private application code
│   ├── api/           # HTTP handlers (Gin)
│   ├── docker/        # Container orchestration
│   ├── course/        # Course content & logic
│   └── websocket/     # Terminal WebSocket handlers
├── src/               # Frontend source
│   ├── components/    # React components
│   ├── pages/         # Route pages
│   ├── store/         # Zustand state
│   └── hooks/         # Custom hooks
├── tests/playwright/  # E2E tests
└── courses/           # Course content (YAML+MD)
```

## Code Style

### TypeScript/React
- Import order: React → @/* → relative
- Components: PascalCase, Hooks: use*, Stores: *Store
- Use `cn()` helper for Tailwind classes

### Go
- Import: stdlib → external → internal
- Error handling: `fmt.Errorf("action: %w", err)`
- Logging: Chinese messages, English identifiers

## Architecture Hotspots

| Area | File | Lines | Risk |
|------|------|-------|------|
| Docker orchestration | internal/docker/controller.go | 2316 | Concurrency |
| API routes | internal/api/routes.go | 2151 | Long handlers |
| Learn page | src/pages/Learn.tsx | 1464 | Duplicate logic |

## Known Bugs

- Port conflict detection fails (route mismatch)
- Dev server needs proxy config for API
- Container start race conditions in controller.go

## Sub-AGENTS.md

| Path | Description |
|------|-------------|
| internal/api/ | HTTP handlers |
| internal/docker/ | Container orchestration |
| internal/course/ | Course service |
| internal/websocket/ | WebSocket handlers |
| src/components/business/ | UI components |
| src/store/ | Zustand stores |
| src/hooks/ | Custom hooks |
| tests/playwright/ | E2E tests |
| courses/ | Course content |
