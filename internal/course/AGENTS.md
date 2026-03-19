# internal/course - Course Service

**Parent:** `/AGENTS.md`

## OVERVIEW

Course content loading, progress management, step navigation. Handles YAML + Markdown course files.

## FILES

```
course/
├── models.go         # Course, Step, Progress types
├── service.go        # Course CRUD, file loading (803 lines)
├── progress.go       # Progress tracking
├── service_test.go   # Service unit tests
└── progress_test.go  # Progress unit tests
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Load course content | service.go:LoadCourse | YAML parsing, step ordering |
| Progress save/load | progress.go | JSON storage |
| Course types | models.go | Course, Step, ContainerConfig |

## KEY TYPES

```go
type Course struct {
    ID          string   `yaml:"id"`
    Title       string   `yaml:"title"`
    Description string   `yaml:"description"`
    Type        string   `yaml:"type"` // shell/sql/code
    CodeTerminal bool     `yaml:"codeTerminal"`
    ImageID     string   `yaml:"imageid"`
    Port        int      `yaml:"port"`
    Steps       []string `yaml:"steps"`
}
```

## ANTI-PATTERNS

- Progress stored as JSON in container label
- Course files embedded at build time (not runtime dynamic)
