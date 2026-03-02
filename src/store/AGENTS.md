# src/store - State Management

**Parent:** `/AGENTS.md`

## OVERVIEW

Zustand stores for learn session and tour state.

## FILES

```
store/
├── learnStore.ts   # Course, container, progress state
└── tourStore.ts    # Onboarding tour state
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Course state | learnStore.ts | Current course, container, steps |
| Tour state | tourStore.ts | Tour visibility, step tracking |

## KEY STATE

```typescript
// learnStore
{
  currentCourse: Course | null
  containerId: string
  containerStatus: 'stopped' | 'starting' | 'running' | 'paused'
  currentStep: number
  courseProgress: Record<string, number>
}

// tourStore
{
  isActive: boolean
  currentStep: number
  isGloballyDisabled: boolean
}
```

## ANTI-PATTERNS

- Some orchestration logic in Learn.tsx instead of store
- No persistence plugin (tour state uses localStorage manually)
