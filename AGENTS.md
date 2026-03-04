# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** c40e1ff
**Branch:** feat/code-java

## OVERVIEW

Full-stack interactive learning platform: Go 1.25 backend (Gin, Docker SDK, WebSocket) + React 20 frontend (TypeScript, Vite, Tailwind). Runs isolated Docker containers for hands-on courses.

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

## CI/CD

- **Unit tests**: `.github/workflows/unit-tests.yml`
- **E2E tests**: `.github/workflows/playwright.yml`
- **Release**: `.github/workflows/release.yml`
- **Docker**: `.github/workflows/docker-publish.yml`

## Commands

```bash
make install      # Install all deps
make dev          # Hot reload dev (air + vite)
make build        # Production build
make release      # Release binaries
make e2e-playwright  # Run E2E tests
```

## Anti-Patrons

- **No explicit TODOs/FIXMEs** in codebase (clean)
- **No eslintrc/prettierrc** - relies on editor defaults
- **No golangci.yml** - Go linting uses defaults
- **Type safety issue**: `as never` in src/pages/Learn.tsx (lines 64-65) bypasses TypeScript
- **Chinese comments in Makefile** - unusual for English projects (`# 安装依赖`, `# 构建前端`)
- **AtomGit sync workflow** - custom sync to Chinese Git alternative (intentional)

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
| tests/playwright/ | E2E tests |
| courses/ | Course content |
| src/pages/learn | Learn page |
| src/lib/ | Shared utilities |
