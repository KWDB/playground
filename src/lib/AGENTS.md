# src/lib - Shared Utilities

**Parent:** `/AGENTS.md`

## OVERVIEW

Shared utilities and API client for frontend. **7 files**.

## FILES

```
lib/
├── api/
│   ├── client.ts       # Axios instance, interceptors
│   ├── types.ts        # API response types
│   └── client.test.ts  # API client tests
├── http.ts             # Fetch wrapper (legacy)
├── utils.ts            # General helpers
├── progress-mapper.ts  # Progress mapping utilities
└── contrast.ts         # Color contrast helpers
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| API calls | api/client.ts | Axios config, auth interceptors |
| Types | api/types.ts | Course, Container, Progress types |
| Helpers | utils.ts | General utilities |

## CONVENTIONS

- `@/*` path alias → `./src/*`
- API client uses Axios with response interceptors
- Tests co-located: `*.test.ts`

## ANTI-PATTERNS

- Mixed HTTP clients (http.ts + api/client.ts)
- Some utility functions may duplicate lodash/ramda
