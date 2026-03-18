# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-12
**Commit:** 8cdf24d
**Branch:** feat/imgae-mamager

## OVERVIEW

Full-stack interactive learning platform: Go 1.25 backend (Gin, Docker SDK, WebSocket) + React 18 frontend (TypeScript, Vite, Tailwind). Runs isolated Docker containers for hands-on courses.

**Stats:** 448 files, 31,333 lines of code (Go + TS/TSX), 4-level depth

Full-stack interactive learning platform: Go 1.25 backend (Gin, Docker SDK, WebSocket) + React 18 frontend (TypeScript, Vite, Tailwind). Runs isolated Docker containers for hands-on courses.

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
├── cmd/                # CLI commands (start, stop, check)
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

- **Nested Learn page**: `src/pages/Learn.tsx` (file) + `src/pages/learn/` (directory with 11 hooks)
- **Hooks fragmented**: Business hooks in `src/pages/learn/hooks/` instead of centralized `src/hooks/`
- **Duplicate check package**: Both `cmd/check/` (17-line wrapper) and `internal/check/` exist
- **Scattered config**: `src/config/tourSteps.ts` alongside store-based config

## Architecture Hotspots

| Area | File | Lines | Risk |
|------|------|-------|------|
| Docker orchestration | internal/docker/controller.go | 2316 | Concurrency |
| API routes | internal/api/routes.go | 2151 | Long handlers |

## Code Map

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| NewContainer | func | internal/docker/controller.go | 12 | Core orchestration |
| RunCourse | func | internal/api/handlers_run.go | 8 | Course execution |
| LearnStore | store | src/store/learnStore.ts | 15 | Frontend state |
| WebSocketHandler | struct | internal/websocket/handler.go | 6 | Terminal multiplex |
| Learn page | src/pages/Learn.tsx | 1464 | Duplicate logic |

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

## CI/CD

- **Unit tests**: `.github/workflows/unit-tests.yml`
- **E2E tests**: `.github/workflows/playwright.yml`
- **Release**: `.github/workflows/release.yml`
- **Docker**: `.github/workflows/docker-publish.yml`
- **AtomGit sync**: `.github/workflows/sync-to-atomgit.yml` (China-centric)

## Commands

```bash
make install      # Install all deps
make dev          # Hot reload dev (air + vite)
make build        # Production build
make release      # Release binaries
make e2e-playwright  # Run E2E tests
```

# NV|- **Release dead code**: ~140 lines commented-out Homebrew job in release.yml
# JQ|- **Duplicate check package**: Both `/cmd/check/` and `/internal/check/` exist (CLI vs core logic)
# VR|- **Hooks fragmented**: Most hooks in `/src/pages/learn/hooks/` not centralized
# MV|- **Check command deprecated**: `cmd/check/check.go` uses Cobra's Deprecated field
# KW|- **Format check**: Uses `go fmt` + `git diff` instead of golangci-lint
# TQ|- **Lenient frontend**: TypeScript/ESlint runs with `|| true` in CI
# MV|- **Multi-registry**: Pushes to ghcr.io, Docker Hub, and Alibaba Cloud ACR
- **Duplicate check package**: Both `/cmd/check/` and `/internal/check/` exist (CLI vs core logic)
- **Hooks fragmented**: Most hooks in `/src/pages/learn/hooks/` not centralized
- **Check command deprecated**: `cmd/check/check.go` uses Cobra's Deprecated field
- **Format check**: Uses `go fmt` + `git diff` instead of golangci-lint
- **Lenient frontend**: TypeScript/ESlint runs with `|| true` in CI
- **Multi-registry**: Pushes to ghcr.io, Docker Hub, and Alibaba Cloud ACR
- **Release dead code**: ~140 lines commented-out Homebrew job in release.yml
- **Duplicate check package**: Both `/cmd/check/` and `/internal/check/` exist (CLI vs core logic)
- **Hooks fragmented**: Most hooks in `/src/pages/learn/hooks/` not centralized
- **Check command deprecated**: `cmd/check/check.go` uses Cobra's Deprecated field

## Known Bugs

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
| src/lib/ | Shared utilities |
| src/pages/learn | Learn page |
| tests/playwright/ | E2E tests |
| courses/ | Course content |
