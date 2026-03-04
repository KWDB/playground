# courses - Course Content

**Parent:** `/AGENTS.md`

## OVERVIEW

Course definitions (YAML + Markdown). Embedded in binary at build time.

## STRUCTURE

```
courses/
├── quick-start/
│   ├── index.yaml    # Course metadata
│   ├── intro.md
│   ├── step1.md
│   └── finish.md
├── sql/
├── python-kwdb/      # Code terminal course (Python)
├── java-kwdb/       # Code terminal course (Java)
├── smart-meter/
├── multi-mode/
├── install/
└── data-query/
```

## COURSE TYPES

| Type | Terminal | Example |
|------|----------|---------|
| `shell` | Shell (xterm.js) | quick-start, install |
| `sql` | SQL (CodeMirror) | sql |
| `code` | Code (Python/Bash/Java) | python-kwdb, java-kwdb |

## YAML SCHEMA

```yaml
id: string
title: string
description: string
type: shell|sql|code
imageid: string       # Docker image
port: int             # Exposed port
cmd: [string]         # Container command
steps: [string]       # Step file names
estimatedMinutes: int
difficulty: beginner|intermediate|advanced
tags: [string]
codeTerminal: bool    # For code type
```

## ANTI-PATTERNS

- Static content (no runtime updates)
- Embedded at build (not fetched from server)
- Step files must exist for each entry in steps[]
