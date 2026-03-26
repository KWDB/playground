# src/pages - Page Components

**Parent:** `/AGENTS.md`

## OVERVIEW

React Router page components with Zustand store integration. **4 top-level pages** + modularized learn/ subdirectory. Pages handle routing params, orchestrate child components/hooks, and manage tour triggers.

## STRUCTURE

```
pages/
├── Home.tsx                    # Platform entry (400+ lines)
├── CourseList.tsx             # Course catalog (1281 lines)
├── CourseImageManagement.tsx   # Image manager (1307 lines)
├── Learn.tsx                  # Learn orchestrator (imports learn/)
├── home/                      # Home page sections
│   ├── HomeHeroSection.tsx
│   ├── HomeFeatureSection.tsx
│   ├── homeStyles.ts
│   ├── homeContent.ts
│   └── types.ts
└── learn/                     # Modular learn components (see learn/AGENTS.md)
    ├── Learn.tsx              # DUPLICATE - also at pages/Learn.tsx
    ├── index.ts               # Barrel exports
    ├── hooks/                 # 10 business hooks
    ├── components/            # 5 UI components
    ├── utils/                 # 4 helpers
    └── markdown/              # 4 MD rendering files
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Route entry point | pages/Learn.tsx | Orchestrates learn/ modules via barrel |
| Course catalog | CourseList.tsx | Filtering, search, card grid |
| Image management | CourseImageManagement.tsx | Pull, clean, diagnose zones |
| Home sections | home/HomeHeroSection.tsx | Hero, features, styles separated |
| Learn page hooks | learn/hooks/index.ts | All exports from here |

## KEY PATTERNS

- **Barrel exports**: `learn/index.ts` re-exports everything from hooks/components/utils/markdown
- **Store binding**: `useLearnStore()` + `useTourStore()` for state management
- **Tour trigger**: First-visit detection via `seenPages` + `startTour()` in useEffect
- **Resizable panels**: `react-resizable-panels` for terminal/content split
- **cn() helper**: Tailwind class merging via `lib/utils.ts`

## ANTI-PATTERNS

- **1300+ line pages**: CourseList.tsx, CourseImageManagement.tsx need split (by feature or component)
- **Duplicate Learn.tsx**: `pages/Learn.tsx` (302 lines actual, imports learn/) vs `pages/learn/Learn.tsx` (1464 lines) — confusion about which is orchestrator
- **Fragmented hooks**: 10 hooks in `learn/hooks/` instead of centralized `src/hooks/`
- **TypeScript strict OFF**: `strict: false` in tsconfig — type errors silently ignored
- **Tour logic in page**: Tour trigger/useEffect in Learn.tsx instead of a dedicated hook

## DEPENDENCY CHAIN

```
pages/Learn.tsx
  ├─ useLearnStore (store)
  ├─ useTourStore (store)
  └─ learn/index.ts (barrel)
       ├─ hooks/useLearnContainer → useContainerInit/Actions/Monitoring/Refs
       ├─ hooks/useLearnCourse → useCourseProgress
       ├─ hooks/useLearnActions → useExecCommand, useLearnMarkdown
       ├─ components/LearnTopBar, LearnTerminalPanel, LearnDialogs
       └─ markdown/MarkdownRenderer
```
