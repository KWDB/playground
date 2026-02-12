# AGENTS.md - KWDB Playground Guidelines

## Quick Commands

| Task | Command |
|------|---------|
| Install deps | `make install` (runs `pnpm install` & `go mod tidy`) |
| Dev server | `make dev` (starts backend :3006 & frontend) |
| Run all Go tests | `go test ./...` |
| Single Go test | `go test -v -run TestName ./package` |
| Run all E2E tests | `make e2e-playwright` or `pnpm run test:pw` |
| Single E2E test | `npx playwright test --project=quick-start -g "test name"` |
| TypeScript check | `pnpm run check` |
| Lint fix | `pnpm run lint:fix` |
| Go format | `go fmt ./...` |
| Build release | `make release` (creates single binary) |

## Project Overview

**KWDB Playground** - Full-stack interactive learning platform:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Go 1.24 (Gin), Docker SDK, WebSocket (xterm.js integration)
- **Testing**: Playwright for E2E (primary), Go testing for backend logic
- **Infrastructure**: Docker for running isolated course environments

**Tech Stack**: pnpm, Node.js 20+, Go 1.24+

## Code Style

### TypeScript/React

**Import Order**:
```typescript
// 1. React/external libs
import { useState } from 'react';
import { clsx } from 'clsx';

// 2. Internal aliases (@/*)
import { useStore } from '@/store/learnStore';
import { Button } from '@/components/ui/button';

// 3. Relative imports
import { Props } from './types';
```

**Naming Conventions**:
| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `CourseList.tsx` |
| Hooks | camelCase (prefix `use`) | `useCourseContainer.ts` |
| Stores | camelCase (suffix `Store`) | `courseStore.ts` |
| Types/Interfaces | PascalCase | `ContainerInfo`, `CourseProps` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Files | kebab-case | `course-list.tsx`, `api-client.ts` |

**Component Pattern**:
```typescript
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
  // Logic here
  return (
    <div className="p-4">
      <h1>{title}</h1>
    </div>
  );
};
```

**Styling**:
- Use Tailwind CSS for almost everything.
- Use `cn()` helper (clsx + tailwind-merge) for dynamic classes.
```typescript
import { cn } from '@/lib/utils'; // or wherever cn is defined

<div className={cn("base-class", isActive && "active-class")} />
```

### Go

**Import Order** (grouped, std lib first):
```go
import (
    "context"
    "fmt"

    "github.com/gin-gonic/gin"

    "kwdb-playground/internal/logger"
)
```

**Naming**:
- **Packages**: lowercase, single word (e.g., `docker`, `course`).
- **Exported**: PascalCase (e.g., `NewService`).
- **Unexported**: camelCase (e.g., `createClient`).
- **Interfaces**: Suffix `-er` if simple (e.g., `Reader`), or `Interface` if complex.

**Error Handling**:
- Wrap errors with context: `fmt.Errorf("action failed: %w", err)`
- Don't panic unless startup critical.
- Log errors in handlers, return clean errors to API.

**Logging**:
- Use structured logging (`slog` or custom `internal/logger`).
- Log messages in Chinese for operations, identifiers in English.
```go
logger.Info("容器创建成功", "container_id", id, "image", image)
```

## Project Structure

```
.
├── cmd/                # Main applications
├── internal/           # Private application code
│   ├── api/            # HTTP handlers (Gin)
│   ├── docker/         # Container orchestration
│   ├── course/         # Course content & logic
│   └── websocket/      # Terminal WebSocket handlers
├── src/                # Frontend source
│   ├── components/     # React components (ui/ & business/)
│   ├── pages/          # Route pages
│   ├── store/          # Zustand state management
│   ├── hooks/          # Custom hooks
│   └── lib/            # Utilities & API clients
├── tests/              # E2E tests (Playwright)
└── docker/             # Docker build & compose files
```

## Common Tasks

### Add New API Endpoint
1.  **Define Route**: In `internal/api/routes.go`.
2.  **Implement Handler**: Create/update handler in `internal/api/`.
3.  **Business Logic**: Implement core logic in `internal/{package}/`.
4.  **Frontend Type**: Update `src/types/index.ts` with response shape.
5.  **Frontend Client**: Add method to `src/lib/api/client.ts`.

### Run Verification (Before Commit)
```bash
go fmt ./... && pnpm run lint:fix  # Format
go test ./...                      # Backend tests
pnpm run check                     # TS types
pnpm run test:pw                   # E2E tests (if changing core flows)
```

## Testing Strategy

-   **Backend**: Unit tests for logic in `internal/`. Mock Docker client if needed.
-   **Frontend**: Primarily E2E via Playwright (`tests/`).
    -   Use `data-testid` attributes for selectors: `data-testid="submit-btn"`.
    -   Focus on user flows (Start Course -> Terminal Interaction -> Success).
    -   Mock API calls only if testing UI states; prefer real integration for E2E.
-   **Container Tests**: Ensure `docker/` package tests clean up containers.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| SERVER_PORT | 3006 | HTTP server port |
| DEBUG_PORT | 2345 | Debugger port |
| LOG_LEVEL | info | debug/info/warn/error |
| GIN_MODE | debug | Gin mode |
| COURSES_USE_EMBED | false | Use embedded FS (release) |

