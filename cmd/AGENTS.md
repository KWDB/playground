# CLI Entry Point

**Generated:** 2026-03-26

## OVERVIEW

Cobra CLI with 5 subcommands: `start`, `stop`, `doctor`, `check` (deprecated), `update`. Single binary entry via `main.go` (78 lines). Embeds frontend (`dist/*`) and courses (`courses/*`) via `go:embed`.

## STRUCTURE

```
cmd/
├── start/start.go   (442 lines) - HTTP server bootstrap, daemon, browser launch
├── stop/stop.go     (119 lines) - Daemon termination via SIGTERM/SIGKILL
├── doctor/doctor.go (119 lines) - Environment diagnostics, calls internal/check
├── check/check.go   (17 lines)  - DEPRECATED wrapper to doctor
└── update/update.go (71 lines)  - Self-update via binary or Homebrew
```

## KEY FILES

| File | Role |
|------|------|
| `main.go` | Root Cobra command registration, embed.FS setup |
| `start/start.go` | Server bootstrap: Gin router, Docker init, WebSocket manager, static file serving |
| `stop/stop.go` | PID-based process termination with graceful fallback to port scanning |
| `doctor/doctor.go` | Delegates to `internal/check` for Docker/image/port/courses/progress diagnostics |
| `update/update.go` | Upgrade modes: Binary download, Homebrew, Docker (blocked) |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new CLI flag | `cmd/start/start.go:434-439` (Flags section in NewCommand) |
| Change default port | `internal/config/` (SERVER_PORT default 3006) |
| PID file path | `cmd/start/start.go:33` and `cmd/stop/stop.go:20` (must match) |
| Daemon fork logic | `cmd/start/start.go:48-61` (runAsDaemon branch) |
| Browser auto-open | `cmd/start/start.go:341-367` (platform-specific openBrowser) |

## COMMANDS

```bash
# Start server (daemon mode by default)
kwdb-playground start
kwdb-playground start --no-daemon    # Foreground
kwdb-playground start --no-open      # Skip browser launch
kwdb-playground start --port 8080    # Custom port

# Stop server
kwdb-playground stop

# Environment diagnostics
kwdb-playground doctor
kwdb-playground doctor --fix         # Auto-fix issues
kwdb-playground doctor --fix-scope docker  # Fix specific area

# Update
kwdb-playground update

# Deprecated (redirects to doctor)
kwdb-playground check   # Shows "请使用 doctor 命令替代 check"
```

## ANTI-PATTERN

`cmd/check/check.go` is a 17-line deprecated wrapper. It aliases `doctor.NewCommand` and hides the command. Do not add new functionality here; all diagnostics live in `internal/check/`.
