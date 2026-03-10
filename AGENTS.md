# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-10
**Commit:** a5a2a4e
**Branch:** feat/docker-api-version

## OVERVIEW

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

## Architecture Hotspots

| Area | File | Lines | Risk |
|------|------|-------|------|
| Docker orchestration | internal/docker/controller.go | 2316 | Concurrency |
| API routes | internal/api/routes.go | 2151 | Long handlers |
| Learn page | src/pages/Learn.tsx | 1464 | Duplicate logic |

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

## Anti-Patrons (THIS PROJECT)

- **No explicit TODOs/FIXMEs** in codebase (clean)
- **No eslintrc/prettierrc** - ESLint 9 flat config, relies on editor defaults
- **No golangci.yml** - Go linting uses defaults
- **Type safety issue**: `as never` in src/pages/Learn.tsx (lines 64-65) bypasses TypeScript
- **Chinese comments in Makefile** - unusual for English projects (`# 安装依赖`, `# 构建前端`)
- **AtomGit sync workflow** - custom sync to Chinese Git alternative (intentional)
- **Non-blocking CI checks**: Frontend `check` and `lint` use `|| true` in unit-tests.yml
- **Makefile duplicate code**: `stop` target has identical commands duplicated (lines 168-187)
- **Docker socket mount**: docker-compose.yml mounts `/var/run/docker.sock` (security consideration)
- **Release dead code**: ~140 lines commented-out Homebrew job in release.yml

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
