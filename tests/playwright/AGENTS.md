# tests/playwright - E2E Tests

**Parent:** `/AGENTS.md`

## OVERVIEW

Playwright E2E tests for course flows, terminal interaction, SQL execution.

## FILES

```
playwright/
├── playwright.config.ts         # Main config
├── playwright.docker.config.ts  # Docker deployment config
├── test-setup.ts               # Shared fixtures (auto-disable tour)
├── quick-start.spec.ts          # Primary flow test
├── sql-terminal.spec.ts         # SQL terminal test
├── code-terminal.spec.ts        # Python code terminal test
├── course-list-status.spec.ts   # Course list test
├── course-pause.spec.ts         # Pause/resume test
├── port-conflict.spec.ts        # Port conflict test
└── docker-deploy.spec.ts        # Docker deployment test
```

## RUN COMMANDS

```bash
# Local (requires server running)
make e2e-playwright
pnpm run test:pw

# Docker deployment
npx playwright test --config=playwright.docker.config.ts

# Single test
npx playwright test --project=quick-start -g "test name"
```

## CONVENTIONS

- Tests use `data-testid` attributes
- Project ordering in config: tests run serially (dependency chain)
- State reset via API endpoints before each test
- LocalStorage cleared via `page.addInitScript`
- Chinese test descriptions (e.g., `test('SQL 终端测试', ...)`)

## STATE RESET PATTERN

```typescript
// In beforeEach
await request.post('/api/progress/:courseId/reset')
await request.delete('/api/containers?courseId=...')
await request.post('/api/courses/:id/stop')
```

## ANTI-PATTERNS

- No dedicated test fixtures - reset done manually in beforeEach
- Screenshots on failure saved to `tests/screenshots/`
- Reports saved to `tests/reports/`
- E2E tests run serially with `workers: 1`
