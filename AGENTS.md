# AGENTS.md - KWDB Playground Guidelines

## Quick Commands

| Task | Command |
|------|---------|
| Install deps | `make install` |
| Dev server | `make dev` (port 3006) |
| Run all Go tests | `go test ./...` |
| Single Go test | `go test -v -run TestName ./package` |
| Run all E2E tests | `make e2e-playwright` or `pnpm run test:pw` |
| Single E2E test | `npx playwright test --project=quick-start` |
| TypeScript check | `pnpm run check` |
| Lint fix | `pnpm run lint:fix` |
| Go format | `go fmt ./...` |

## Project Overview

**KWDB Playground** - Full-stack interactive learning platform:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Go (Gin), Docker integration, WebSocket terminal
- **Testing**: Playwright E2E tests

**Tech Stack**: pnpm, Node.js 20, Go 1.24

## Code Style

### TypeScript/React

**Import Order**:
```typescript
// 1. React/external libs
import { useState } from 'react';

// 2. Internal aliases (@/*)
import { useStore } from '@/store/learnStore';

// 3. Relative imports
import { Props } from './types';
```

**Naming**:
| Pattern | Example |
|---------|---------|
| Components | `CourseList.tsx` (PascalCase) |
| Hooks | `useCourseContainer.ts` (use prefix) |
| Stores | `courseStore.ts` (Store suffix) |
| Types | `ContainerInfo` (PascalCase) |
| Constants | `MAX_RETRY_COUNT` (UPPER_SNAKE_CASE) |
| Files | `kebab-case.ts` (kebab-case) |

**Component Pattern**:
```typescript
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
  // logic
};
```

**Styling**: Tailwind CSS + `clsx` + `tailwind-merge`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Go

**Import Order** (grouped, no spaces between groups):
```go
import (
    "context"
    "fmt"

    "github.com/gin-gonic/gin"

    "kwdb-playground/internal/logger"
)
```

**Naming**:
| Pattern | Example |
|---------|---------|
| Packages | `docker`, `course` (lowercase) |
| Exported | `NewService`, `ContainerInfo` (PascalCase) |
| Unexported | `createClient`, `containerCache` (camelCase) |
| Interfaces | `DockerClientInterface` (-er suffix) |

**Error Handling**:
```go
// ✅ Return errors with context
return nil, fmt.Errorf("failed to create container: %w", err)

// ❌ Don't panic in library code
logger.Error("容器启动失败", "错误", err.Error())
```

**Logging**: Chinese messages, English identifiers
```go
logger.Info("容器创建成功", "容器ID", containerID, "镜像", image)
```

## Type Definitions

Centralized at `src/types/index.ts`:
```typescript
import { ContainerInfo } from '@/types';
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

### Run Verification
```bash
go build ./... && pnpm run check  # TypeScript + build
go test ./...                      # All tests
go fmt ./... && pnpm run lint:fix  # Formatting
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| SERVER_PORT | 3006 | HTTP server port |
| DEBUG_PORT | 2345 | Debugger port |
| LOG_LEVEL | info | debug/info/warn/error |
| GIN_MODE | debug | Gin mode |
| COURSES_USE_EMBED | false | Use embedded FS (release) |

## Testing Best Practices

- Use `data-testid` for stable selectors in E2E tests
- Prefer component visibility checks over specific text matching
- Use `{ timeout: 120000 }` for container operations
- Clean up containers after tests: `request.post('/api/courses/{id}/stop')`
