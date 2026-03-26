# internal/upgrade - Self-Update Service

**Parent:** `/internal/api/AGENTS.md`

## OVERVIEW

Self-update service for kwdb-playground. Checks GitHub/AtomGit for new releases, downloads binaries, and replaces the running executable. Supports Homebrew and Docker deployment modes.

## KEY FILES

| File | Lines | Role |
|------|-------|------|
| `internal/upgrade/service.go` | 507 | Core upgrade logic |
| `internal/api/handlers_upgrade.go` | 681 | HTTP handlers (duplicates some service logic) |

## KEY TYPES

```go
type CheckResult struct {
    CurrentVersion, LatestVersion string
    HasUpdate, CanUpgrade, DockerDeploy bool
    Message string
}

type Plan struct {
    Mode           Mode  // ModeBrew, ModeBinary, ModeDocker, ModeUnsupported, ModeNoUpdate
    CurrentVersion, LatestVersion string
    DownloadURL, ExecutablePath string
    Message string
}

type Mode string  // "brew" | "binary" | "docker" | "unsupported" | "no_update"
```

## ENDPOINTS

```
GET  /api/check-upgrade   - Check if update available
POST /api/upgrade         - Download and apply upgrade (binary or brew)
POST /api/upgrade-docker  - Pull new image and restart container
```

## WHERE TO LOOK

| Task | File | Function | Notes |
|------|------|----------|-------|
| Version check | handlers_upgrade.go:204 | checkUpgrade | Calls upgradepkg.Check() |
| Upgrade prep | service.go:128 | Prepare() | Determines mode (brew/binary/docker) |
| Binary download | service.go:265 | PerformUpgrade() | Downloads to temp, replaces exe |
| Brew upgrade | service.go:246 | PerformBrewUpgrade() | Runs `brew upgrade` |
| Docker upgrade | handlers_upgrade.go:225 | upgradeDocker() | Pulls image, rebuilds container |
| GitHub release | service.go:335 | fetchReleaseFromGitHub() | Primary source |
| AtomGit fallback | service.go:362 | fetchReleaseFromAtomGitWithURL() | Fallback source |
| Version compare | service.go:443 | compareVersions() | Semantic version comparison |

## UPGRADE FLOW

1. `Check()` queries GitHub API for latest release tag
2. `Prepare()` determines upgrade mode based on install method:
   - **Homebrew**: Uses `brew upgrade kwdb-playground`
   - **Binary**: Downloads from GitHub release assets
   - **Docker**: Uses docker:27-cli helper to pull new image
3. `PerformUpgrade()`:
   - Downloads binary to temp file in same directory as executable
   - Creates `.bak-{timestamp}` backup
   - Replaces executable atomically via `os.Rename()`
   - Starts new version with original args + `KWDB_UPGRADE_RESTART=1` env
4. On failure, backup is restored

## ANTI-PATTERNS

- **No rollback mechanism**: If new binary fails to start after replacement, user must manually restore `.bak-*` file
- **Duplicate code**: handlers_upgrade.go duplicates findAssetDownloadURL(), compareVersions(), fetchLatestRelease() from service.go
- **Blocking upgrade goroutine**: Upgrade runs in goroutine with 5-10 minute timeout, no progress tracking
