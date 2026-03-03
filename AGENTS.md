# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-03
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
│   ├── hooks/         # Custom hooks
│   └── lib/          # Shared utilities
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

## Learn Page Architecture

Modular architecture with hooks + components. See `src/pages/learn/AGENTS.md` for details.

## Known Bugs
## Learn 页面模块化架构

`src/pages/Learn.tsx` 已重构为“页面编排 + hooks 业务逻辑 + 子组件渲染”的分层结构：

- `src/pages/learn/hooks/`：容器生命周期、课程初始化、步骤导航、命令执行等逻辑
- `src/pages/learn/components/`：顶部状态栏、终端区、错误态、弹窗等 UI 组件
- `src/pages/learn/utils/`：错误映射、Markdown 预处理、容器等待与判定逻辑
- `src/pages/learn/constants.ts` / `types.ts`：常量与类型定义
- `src/pages/learn/index.ts`：barrel export，统一导出 learn 子模块

架构图（简化）：

```text
Learn.tsx
  ├─ hooks
  │   ├─ useLearnContainer
  │   ├─ useLearnCourse
  │   ├─ useLearnActions
  │   ├─ useCourseProgress
  │   └─ useExecCommand / useLearnMarkdown
  ├─ components
  │   ├─ LearnTopBar
  │   ├─ LearnTerminalPanel
  │   ├─ LearnDialogs
  │   └─ LearnLoadingState / LearnErrorState
  └─ utils
      ├─ errors.ts
      ├─ markdown.ts
      └─ container.ts
```

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
