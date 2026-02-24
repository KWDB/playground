# src/components/business - Interactive UI Components

**Parent:** `/AGENTS.md`

## OVERVIEW

Core interactive components: Terminal, SQL Editor, SQL Terminal, Port Conflict Handler. These connect to WebSocket endpoints.

## FILES

```
business/
├── Terminal.tsx          # Xterm.js terminal (670 lines)
├── SqlCodeEditor.tsx     # CodeMirror SQL editor (514 lines)
├── SqlTerminal.tsx       # SQL WebSocket client (506 lines)
├── PortConflictHandler.tsx # Port conflict modal (372 lines)
├── ImageSelector.tsx     # Docker image picker
└── terminal/             # Sub-components
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Terminal WS issues | Terminal.tsx | connectWebSocket(), reconnect logic |
| SQL execution | SqlTerminal.tsx | WebSocket protocol, result formatting |
| Code completion | SqlCodeEditor.tsx | custom completions, signatures |
| Port conflicts | PortConflictHandler.tsx | cleanup/retry flow |

## CONVENTIONS

- Components use refs for WebSocket connections (`wsRef`, `wsProgressRef`)
- Terminal sizing uses `ResizeObserver` + `useEffect` debouncing
- SQL results use timezone formatting via `parseTimestampAsUtc`

## ANTI-PATTERNS

- `console.warn` used in production (Terminal.tsx, Learn.tsx)
- `!important` in CSS (SqlCodeEditor.tsx line ~50)
- Duplicate orchestration: some logic duplicated in store vs page

## KEY ENDPOINTS

- `/ws/terminal?container_id=...` - Interactive terminal
- `/ws/sql?container_id=...` - SQL execution
- `/api/courses/:id/check-port-conflict` - Port check
- `/api/courses/:id/cleanup-containers` - Cleanup
