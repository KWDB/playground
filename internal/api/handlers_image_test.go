package api

import (
	"testing"

	"kwdb-playground/internal/course"
)

func TestCollectTargetCourseIDs(t *testing.T) {
	courses := map[string]*course.Course{
		"course-b": {ID: "course-b", Title: "B"},
		"course-a": {ID: "course-a", Title: "A"},
		"course-c": {ID: "course-c", Title: "C"},
	}

	tests := []struct {
		name  string
		input []string
		want  []string
	}{
		{
			name:  "empty input returns all sorted",
			input: nil,
			want:  []string{"course-a", "course-b", "course-c"},
		},
		{
			name:  "filters invalid and trims duplicates",
			input: []string{" course-c ", "course-x", "course-a", "course-c", ""},
			want:  []string{"course-a", "course-c"},
		},
		{
			name:  "no matched courses",
			input: []string{"unknown"},
			want:  []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := collectTargetCourseIDs(courses, tt.input)
			if len(got) != len(tt.want) {
				t.Fatalf("len(got)=%d len(want)=%d", len(got), len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("got[%d]=%s want[%d]=%s", i, got[i], i, tt.want[i])
				}
			}
		})
	}
}
