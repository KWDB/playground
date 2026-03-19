package api

import (
	"testing"

	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
)

func TestResolveSQLPortByRuntime(t *testing.T) {
	baseCourse := &course.Course{
		ID: "sql",
		Backend: course.Backend{
			Port:          3000,
			ContainerPort: 26257,
		},
	}

	tests := []struct {
		name         string
		courseObj    *course.Course
		container    *docker.ContainerInfo
		dockerDeploy bool
		expectedPort int
	}{
		{
			name: "docker deploy uses container port",
			courseObj: &course.Course{
				ID: "sql",
				Backend: course.Backend{
					Port:          3000,
					ContainerPort: 26257,
				},
			},
			dockerDeploy: true,
			expectedPort: 26257,
		},
		{
			name: "native mode uses mapped host port",
			courseObj: baseCourse,
			container: &docker.ContainerInfo{
				Ports: map[string]string{
					"26257": "35432",
				},
			},
			dockerDeploy: false,
			expectedPort: 35432,
		},
		{
			name: "fallback to backend port when no mapping",
			courseObj:    baseCourse,
			container:    &docker.ContainerInfo{Ports: map[string]string{}},
			dockerDeploy: false,
			expectedPort: 3000,
		},
		{
			name: "compat old key fallback to backend port key",
			courseObj: baseCourse,
			container: &docker.ContainerInfo{
				Ports: map[string]string{
					"3000": "31000",
				},
			},
			dockerDeploy: false,
			expectedPort: 31000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveSQLPortByRuntime(tt.courseObj, tt.container, tt.dockerDeploy)
			if got != tt.expectedPort {
				t.Fatalf("resolveSQLPortByRuntime got=%d, want=%d", got, tt.expectedPort)
			}
		})
	}
}
