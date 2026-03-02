# src/hooks - React Hooks

**Parent:** `/AGENTS.md`

## OVERVIEW

Custom React hooks for state management and UI logic.

## FILES

```
hooks/
├── useCourseContainer.ts  # Container lifecycle (start/stop/status)
└── useMarkdown.ts        # Markdown rendering helpers
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Container ops | useCourseContainer.ts | Start, stop, status polling |
| Markdown render | useMarkdown.ts | Content processing |

## ANTI-PATTERNS

- Polling-based status checks (could use WebSocket)
- Some logic duplicated in Learn.tsx
