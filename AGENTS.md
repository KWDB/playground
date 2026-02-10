# AGENTS.md - KWDB Playground Guidelines for AI Coding Agents

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `make install` |
| Dev server | `make dev` (port 3006) |
| Run all Go tests | `go test ./...` |
| Single test | `go test -v -run TestName ./package` |
| Go coverage | `go test ./... -coverprofile=c.out && go tool cover -func=c.out` |
| TypeScript check | `pnpm run check` |
| Lint fix | `pnpm run lint:fix` |
| Go format | `go fmt ./...` |

## Project Overview

**KWDB Playground** - Full-stack web app for interactive KWDB learning:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Go (Gin), Docker integration, WebSocket terminal
- **Testing**: Playwright E2E tests

**Tech Stack**: pnpm, Node.js 20, Go 1.24

## Build & Development

### Core Commands
```bash
make install          # Install all dependencies
make dev             # Hot-reload dev server (port 3006)
make check            # Verify dev environment
make build            # Full production build
make release          # Single binary with embedded assets
make fmt              # Format all code
```

### Testing Commands
```bash
# Go Tests
go test ./...                              # All tests
go test -v ./internal/api/...               # Specific package
go test -v -run TestFindContainer api/...  # Single test function
go test -v -cover ./...                    # With coverage

# Playwright E2E
pnpm run pw:install                       # Install browsers
pnpm run test:pw                          # Run all E2E tests
npx playwright test --project=quick-start  # Specific project
```

## Code Style Guidelines

### TypeScript/React

**Imports** (order matters):
```typescript
// 1. React and external libs
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// 2. Internal aliases (@/*)
import { useLearnStore } from '@/store/learnStore';
import { ContainerInfo } from '@/types';

// 3. Relative imports
import { NavbarProps } from './types';
```

**Naming Conventions**:
| Pattern | Example |
|---------|---------|
| Components | `CourseList.tsx` (PascalCase) |
| Hooks | `useCourseContainer.ts` (camelCase + use prefix) |
| Stores | `courseStore.ts` (camelCase + Store suffix) |
| Types | `ContainerInfo` (PascalCase) |
| Constants | `MAX_RETRY_COUNT` (UPPER_SNAKE_CASE) |
| Files | `kebab-case.ts` (kebab-case) |

**Components**:
```typescript
// Props interface
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

// Functional component with explicit typing
const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
  // logic
};
```

**State Management**:
- Global state: Zustand in `src/store/`
- Local state: React hooks (`useState`, `useEffect`)
- Custom hooks: `src/hooks/`

**Styling**: Tailwind CSS + `clsx` + `tailwind-merge`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Go

**Imports** (grouped, no spaces between groups):
```go
import (
    "context"
    "fmt"
    "sync"

    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"

    "kwdb-playground/internal/logger"
)
```

**Naming**:
| Pattern | Example |
|---------|---------|
| Packages | `docker`, `course` (lowercase, single word) |
| Exported | `NewService`, `ContainerInfo` (PascalCase) |
| Unexported | `createClient`, `containerCache` (camelCase) |
| Interfaces | `DockerClientInterface` (-er suffix) |
| Constants | `const blocks with comments` |

**Error Handling**:
```go
// ✅ Do: Return errors with context
return nil, fmt.Errorf("failed to create container: %w", err)

// ❌ Don't: Panic in library code
if err != nil {
    panic("should never happen")
}

// Log at appropriate level
logger.Error("容器启动失败", "错误", err.Error())
```

**Comments**:
- Package comment at top of file
- Exported functions require doc comments
- Use Chinese for consistency with existing codebase

## Logging Standards (see docs/LOGGING.md)

**Format**: `[LEVEL] [MODULE] message key=value`

**Examples**:
```go
// ✅ Recommended
logger.Info("容器创建成功", "容器ID", containerID, "镜像", image)
logger.Debug("[CourseService] 开始加载课程", "路径", coursesDir)
logger.Error("容器启动失败", "错误", err.Error())

// ❌ Avoid
logger.Info("Container created successfully: " + containerID)
```

**Language**: Chinese messages, English identifiers

## Type Definitions

Centralized at `src/types/index.ts`:
```typescript
// Import from centralized location
import { ContainerInfo, PortConflictInfo, SqlInfo } from '@/types';

// Legacy files still work (re-exports from index)
import { ContainerInfo } from '@/types/container';
import { PortConflictInfo } from '@/types/port-conflict';
```

## Project Structure

```
internal/
  api/           # HTTP handlers
  docker/        # Container management
  course/        # Course content
  websocket/     # WebSocket terminals
  logger/        # Logging
  config/        # Configuration
src/
  components/    # React components
  pages/         # Page components
  store/         # Zustand stores
  hooks/         # Custom hooks
  types/         # Centralized types
  lib/api/       # API client
```

## Common Tasks

### Add API Endpoint
1. Handler: `internal/api/routes.go`
2. Business logic: appropriate package in `internal/`
3. Types: `src/types/index.ts`
4. API client: `src/lib/api/client.ts`

### Add Frontend Component
1. Create: `src/components/business/ComponentName.tsx`
2. Types: `src/types/index.ts` (if shared)
3. Export from parent's `index.ts` if reusable

### Run Verification
```bash
go build ./... && pnpm run check  # TypeScript + build
go test ./...                      # All tests
go fmt ./... && pnpm run lint:fix  # Code formatting
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| SERVER_PORT | 3006 | HTTP server port |
| DEBUG_PORT | 2345 | Debugger port |
| LOG_LEVEL | info | debug/info/warn/error |
| GIN_MODE | debug | Gin mode |
