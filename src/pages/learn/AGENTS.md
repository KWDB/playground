# src/pages/learn - Learn Page Module

**Parent:** `/AGENTS.md`

## OVERVIEW

Page orchestration + hooks + subcomponents for interactive course learning. **32 files**, modularized architecture.

## STRUCTURE

```
learn/
├── Learn.tsx           # Page orchestrator (1464 lines)
├── index.ts            # Barrel exports
├── types.ts            # TypeScript interfaces
├── constants.ts        # Step constants, config
├── hooks/              # Business logic (12 files)
├── components/         # UI components (6 files)
├── utils/              # Helpers (3 files)
└── markdown/           # MD rendering (4 files)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Container lifecycle | hooks/useLearnContainer.ts | Start/stop/status polling |
| Course state | hooks/useLearnCourse.ts | Step navigation, progress |
| Markdown render | markdown/MarkdownRenderer.tsx | Code block handling |
| Error mapping | utils/errors.ts | Error → user message |
| Container utils | utils/container.ts | Wait, check, cleanup |

## HOOKS DEPENDENCY

```
useLearnCourse (top)
  └─ useLearnContainer
      ├─ useContainerInit
      ├─ useContainerActions
      ├─ useContainerMonitoring
      └─ useContainerRefs

useLearnActions (sidebar)
  └─ useExecCommand
  └─ useLearnMarkdown
```

## ANTI-PATTERNS

- Duplicate orchestration with store (some logic in Learn.tsx)
- Polling-based status checks (WebSocket would be better)
- 1464-line Learn.tsx (needs further modularization)

## CONVENTIONS

- Barrel exports via `index.ts`
- Hooks: `use*Container*`, `use*Learn*`, `use*Course*`
- Components: `Learn*` prefix (PascalCase)
