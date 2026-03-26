# internal/check/

Environment diagnostics and auto-remediation system (1511 lines Go).

## OVERVIEW

Two-layer system: `check.go` runs diagnostics, `fix.go` applies remedies. Checks validate Docker, ports, courses, progress files, PID files, and service health. Fixes support progress store reconstruction, port deconfliction, and PID file repair.

## KEY FILES

| File | Lines | Role |
|------|-------|------|
| check.go | 835 | Diagnostics orchestrator and individual check functions |
| fix.go | 676 | Auto-remediation with dry-run support |

## KEY TYPES

```go
// check.go
type Item  struct { Name, Message, Details string; OK bool }
type Summary struct { OK bool; Items []Item }

// fix.go
type FixOptions struct { DryRun bool; FixScope string }
type FixResult struct { Name, Status, Message, Details string }
```

## WHERE TO LOOK

| Task | File | Function |
|------|------|----------|
| Docker API version check | check.go | `DockerEnv()` line 153 |
| Port occupation (lsof) | check.go | `PortOccupation()` line 219 |
| Course integrity validation | check.go | `CoursesIntegrity()` line 292 |
| Progress JSON health | check.go | `ProgressStoreHealth()` line 330 |
| PID file validation | check.go | `ProcessFileHealth()` line 405 |
| Service /health probe | check.go | `ServiceHealth()` line 631 |
| Registry availability probe | check.go | `ImageSourcesAvailability()` line 724 |
| Main check orchestrator | check.go | `RunFromService()` line 75 |
| Progress store rebuild | fix.go | `fixProgressStore()` line 436 |
| Port conflict resolution | fix.go | `fixPortOccupation()` line 296 |
| PID file rewrite | fix.go | `fixProcessFile()` line 492 |
| Fix orchestrator | fix.go | `ApplyFixes()` line 35 |

## CHECK TYPES

| Check | What it validates |
|-------|------------------|
| DockerEnv | Docker client/daemon connection, API version >= 1.41 |
| ImageSourcesAvailability | Docker Hub, ghcr.io, Aliyun ACR reachability (45s cache) |
| PortOccupation | Port free or occupied by kwdb-playground |
| CoursesIntegrity | Course titles, steps, intro/finish text presence |
| ProgressStoreHealth | progress.json exists, valid JSON, step bounds, completed consistency |
| ProcessFileHealth | PID file exists, PID valid, process running |
| ExecutablePathHealth | Resolves running executable via lsof/ps |
| ServiceHealth | TCP connect + /health returns 200 with KWDB signature |

## FIX SCOPES

`--fix-scope progress|docker|image-sources|port|courses|process-file|executable|service|all`

- **progress**: Backs up and rebuilds `data/progress.json`
- **port**: SIGTERM then SIGKILL conflicting processes
- **process-file**: Rewrites `tmp/kwdb-playground.pid` with current listener PID
- **docker** (macOS only): Launches Docker Desktop app
- **image-sources/courses/service**: No-op with suggestion message

## ANTI-PATTERNS

- Registry probe has 45s in-memory cache but no circuit breaker on Docker API calls
- Progress validation checks course existence but progress stored as JSON in container label (course service)
- Health probe iterates multiple hosts with 800ms timeout each, sequential not parallel in `ServiceHealth`
