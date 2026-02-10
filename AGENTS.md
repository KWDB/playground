# AGENTS.md

This file provides guidelines for AI coding agents working on the KWDB Playground codebase.

## Project Overview

KWDB Playground is a full-stack web application for interactive KWDB learning. It consists of:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Go with Gin framework, Docker integration, WebSocket terminal
- **Testing**: Playwright for E2E tests

## Build Commands

### Development
```bash
# Install all dependencies
make install

# Install dev tools (air, dlv)
make install-tools

# Start development server (hot reload)
make dev

# Check environment
make check
```

### Build
```bash
# Build frontend only
pnpm run build

# Build backend (includes frontend)
make backend

# Full production build
make build

# Release build (embedded assets, single binary)
make release

# Cross-platform builds
make release-linux-amd64
make release-darwin-arm64
make release-windows-amd64
make release-all
```

### Lint/Format
```bash
# Type check
pnpm run check

# Lint TypeScript/React
pnpm run lint
pnpm run lint:fix

# Format Go code
go fmt ./...

# Format all
make fmt
```

### Testing

#### Go Tests
```bash
# Run all Go tests
go test ./...

# Run specific package test
go test ./internal/docker/...

# Run single test function
go test -v -run TestFunctionName ./package

# Run with coverage
go test -v -cover ./...
```

#### Playwright E2E Tests
```bash
# Install browsers (first time)
pnpm run pw:install

# Run all tests
pnpm run test:pw
make e2e-playwright

# Run specific test file
npx playwright test tests/playwright/quick-start.spec.ts

# Run specific project
npx playwright test --project=quick-start

# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Start test server only
make playwright
```

### Cleanup
```bash
make clean          # Remove build artifacts
make stop           # Stop all services
```

## Code Style Guidelines

### TypeScript/React

#### Imports
- Group imports: React/external libs → internal aliases → relative imports
- Use `@/*` alias for internal modules (configured in vite.config.ts and tsconfig.json)
- Example:
```typescript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Database, Home } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { NavbarProps } from './types';
```

#### Naming
- Components: PascalCase (e.g., `CourseList.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useContainer`)
- Stores: camelCase with `Store` suffix (e.g., `courseStore`)
- Types/Interfaces: PascalCase (e.g., `ContainerInfo`)
- Constants: UPPER_SNAKE_CASE for true constants

#### Components
- Use functional components with hooks
- Props interface defined inline or in `types.ts`
- Export default for page components, named exports for reusable components
- Use React.FC type for components with props:
```typescript
const MyComponent: React.FC<MyProps> = ({ prop1, prop2 }) => {
  // component logic
};
```

#### State Management
- Use Zustand for global state
- Use React hooks (useState, useEffect) for local state
- Custom hooks in `src/hooks/` directory

#### Styling
- Use Tailwind CSS classes
- Combine classes with `clsx` and `tailwind-merge`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Go

#### Imports
- Standard library → Third-party → Internal packages
- Group with blank lines between groups
- Example:
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

#### Naming
- Packages: lowercase, single word (e.g., `docker`, `course`)
- Exported: PascalCase (e.g., `NewService`, `ContainerInfo`)
- Unexported: camelCase (e.g., `createClient`, `containerCache`)
- Interfaces: `-er` suffix (e.g., `DockerClientInterface`)
- Constants: use const blocks with clear comments

#### Error Handling
- Return errors, don't panic in library code
- Wrap errors with context using `fmt.Errorf("context: %w", err)`
- Log errors at appropriate levels

#### Comments
- Package comments at top of file
- Exported functions/structs must have doc comments
- Comments in Chinese for consistency with existing codebase

#### Project Structure
```
internal/
  docker/      # Docker client and container management
  course/      # Course content loading and parsing
  api/         # HTTP handlers and routes
  websocket/   # WebSocket terminal handlers
  logger/      # Logging utilities
  config/      # Configuration management
```

## Environment Variables

Key variables (defined in `.env` or Makefile):
- `SERVER_PORT`: Server port (default: 3006)
- `DEBUG_PORT`: Debug port (default: 2345)
- `COURSES_USE_EMBED`: Use embedded filesystem (default: false in dev, true in release)
- `GIN_MODE`: Gin framework mode (debug/release)
- `LOG_LEVEL`: Log level (debug/info/warn/error)

## Testing Best Practices

### Playwright Tests
- Tests in `tests/playwright/*.spec.ts`
- Each test file focuses on one feature
- Tests are sequential (fullyParallel: false in config)
- Use dependencies for test ordering
- Tests use baseURL from playwright.config.ts

### Go Tests
- Test files: `*_test.go`
- Use table-driven tests
- Mock external dependencies (Docker client, etc.)
- Tests alongside source files in same package

## Common Tasks

### Add New API Endpoint
1. Add handler in `internal/api/routes.go`
2. Add business logic in appropriate package
3. Add types if needed
4. Test with `curl` or Playwright

### Add New Course
1. Create directory in `courses/`
2. Add `course.yaml` metadata
3. Add `README.md` content
4. Reload server to pick up changes

### Frontend Component
1. Create in appropriate subdirectory of `src/components/`
2. Use existing UI components from `src/components/ui/`
3. Add to barrel exports if reusable

## CI/CD

GitHub Actions workflows:
- `.github/workflows/playwright.yml`: Run E2E tests on PR/push
- `.github/workflows/release.yml`: Build and release binaries

Package manager: pnpm (specified in package.json)
Node version: 20
Go version: 1.24
