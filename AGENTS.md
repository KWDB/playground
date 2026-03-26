# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-25
**Commit:** 74b5c4c
**Branch:** fix/progress

## OVERVIEW

Full-stack interactive learning platform: Go 1.25 backend (Gin, Docker SDK, WebSocket) + React 18 frontend (TypeScript, Vite, Tailwind). Runs isolated Docker containers for hands-on courses.

**Stats:** 470 files, 32,879 code lines (Go + TS/TSX), 8-level depth

## Quick Commands

| Task | Command |
|------|---------|
| Install deps | `make install` |
| Dev server | `make dev` |
| Run Go tests | `go test ./...` |
| Run E2E tests | `make e2e-playwright` |
| Build release | `make release` |

## Project Structure

```
.
├── cmd/                # CLI commands (start, stop, check, doctor, update)
├── internal/           # Private Go code
│   ├── api/           # HTTP handlers (Gin)
│   ├── docker/        # Container orchestration
│   ├── course/        # Course service
│   └── websocket/     # Terminal WebSocket
├── src/               # Frontend React source
│   ├── pages/         # Route pages (Home, CourseList, Learn)
│   ├── components/    # UI components (business, ui, layout)
│   ├── store/         # Zustand state
│   ├── hooks/         # Custom hooks
│   └── lib/           # Shared utilities
├── tests/playwright/  # E2E tests
├── courses/           # Course content (YAML+MD)
└── docker/            # Runtime images
```

## Code Style

### TypeScript/React
- Import order: React → @/* → relative
- Components: PascalCase, Hooks: use*, Stores: *Store
- Use `cn()` helper for Tailwind classes
- Strict mode OFF in tsconfig

### Go
- Import: stdlib → external → internal
- Error handling: `fmt.Errorf("action: %w", err)`
- Logging: Chinese messages, English identifiers

## Non-Standard Patterns

- **Nested Learn page**: `src/pages/Learn.tsx` (302 lines) + `src/pages/learn/` (directory with hooks/components)
- **Hooks fragmented**: Business hooks in `src/pages/learn/hooks/` instead of centralized `src/hooks/`
- **Duplicate check package**: Both `cmd/check/` (17-line wrapper) and `internal/check/` (835 lines) exist
- **Scattered config**: `src/config/tourSteps.ts` alongside store-based config
- **AI tool dirs**: `.trae/`, `.sisyphus/`, `.qoder/` (non-standard)
- **TypeScript strict mode OFF**: `strict: false` in tsconfig

## Architecture Hotspots

| Area | File | Lines | Risk |
|------|------|-------|------|
| Docker orchestration | internal/docker/controller.go | 2661 | Concurrency |
| API routes | internal/api/routes.go | 528 | Long handlers |
| Learn page | src/pages/learn/ | fragmented | Modularization needed |

## Code Map

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| NewContainer | func | internal/docker/controller.go | 12 | Core orchestration |
| RunCourse | func | internal/api/handlers_run.go | 8 | Course execution |
| LearnStore | store | src/store/learnStore.ts | 15 | Frontend state |
| WebSocketHandler | struct | internal/websocket/handler.go | 6 | Terminal multiplex |
| startCourse | handler | internal/api/routes.go | - | Start course |
| handleTerminalWebSocket | handler | internal/api/routes.go | - | Terminal WS |

## Entry Points

| File | Purpose |
|------|---------|
| main.go | Cobra CLI + embedded server |
| cmd/start/start.go | HTTP server entry |
| src/main.tsx | React frontend entry |
| dist/* | Embedded in binary via go:embed |

## Testing

| Type | Config | Command |
|------|--------|---------|
| Go unit | `*_test.go` | `go test ./...` |
| Vitest | `vitest.config.ts` | `pnpm run test:unit` |
| Playwright | `playwright.config.ts` | `make e2e-playwright` |

### Test Conventions
- **Serial E2E**: Playwright tests run sequentially (worker=1) with project dependencies
- **Chinese descriptions**: Test specs use Chinese (e.g., `test.describe('SQL 终端')`)
- **State reset**: Manual API calls in beforeEach (`/api/progress/:id/reset`, `/api/containers`)
- **Table-driven Go tests**: Uses `t.Run()` subtests
- **No assertion library**: Go tests use standard `t.Errorf()`/`t.Fatalf()`

## CI/CD

- **Unit tests**: `.github/workflows/unit-tests.yml`
- **E2E tests**: `.github/workflows/playwright.yml`
- **Release**: `.github/workflows/release.yml`
- **Docker**: `.github/workflows/docker-publish.yml`
- **AtomGit sync**: `.github/workflows/sync-to-atomgit.yml` (China-centric)

## Commands

```bash
make install        # Install deps
make dev           # Dev server with hot reload
make build         # Production build
make release       # Single binary with embedded assets
make test          # Go + Vitest tests
make e2e-playwright  # E2E tests
make doctor        # Check dev environment
```

## Sub-AGENTS.md

| Path | Description |
|------|-------------|
| cmd/ | CLI entry point |
| internal/api/ | HTTP handlers |
| internal/check/ | Diagnostics + auto-fix |
| internal/course/ | Course service |
| internal/docker/ | Container orchestration |
| internal/upgrade/ | Self-update service |
| internal/websocket/ | WebSocket handlers |
| src/components/business/ | Interactive UI components |
| src/components/ui/ | Reusable UI primitives |
| src/hooks/ | Custom React hooks |
| src/lib/ | Shared utilities |
| src/pages/ | Page components |
| src/pages/learn/ | Learn page module |
| src/store/ | Zustand stores |
| tests/playwright/ | E2E tests |
| courses/ | Course content |
