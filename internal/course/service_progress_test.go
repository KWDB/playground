package course

import (
	"os"
	"testing"
)

func TestNewServiceFromFS_ProgressManagerNotNil(t *testing.T) {
	// Clean up any existing test data
	defer os.RemoveAll("data")

	// Create a minimal service using NewServiceFromFS
	service := NewServiceFromFS(nil, "test_courses")

	// Verify progressManager is initialized
	if service.progressManager == nil {
		t.Fatal("progressManager should not be nil after NewServiceFromFS")
	}

	// Verify we can call progress methods without panic
	userID := "test-user"
	courseID := "test-course"

	// Test GetProgress (should not panic)
	_, exists, err := service.GetProgress(userID, courseID)
	if err != nil {
		t.Errorf("GetProgress failed: %v", err)
	}
	if exists {
		t.Error("Expected no progress for new user, but found existing progress")
	}

	// Test SaveProgress (should not panic)
	err = service.SaveProgress(userID, courseID, 0, false)
	if err != nil {
		t.Errorf("SaveProgress failed: %v", err)
	}

	// Test ResetProgress (should not panic)
	err = service.ResetProgress(userID, courseID)
	if err != nil {
		t.Errorf("ResetProgress failed: %v", err)
	}
}

func TestNewService_ProgressManagerNotNil(t *testing.T) {
	// Clean up any existing test data
	defer os.RemoveAll("data")

	// Create a minimal service using NewService
	service := NewService("test_courses")

	// Verify progressManager is initialized
	if service.progressManager == nil {
		t.Fatal("progressManager should not be nil after NewService")
	}

	// Verify we can call progress methods without panic
	userID := "test-user"
	courseID := "test-course"

	// Test all progress methods (should not panic)
	_, _, _ = service.GetProgress(userID, courseID)
	_ = service.SaveProgress(userID, courseID, 0, false)
	_ = service.ResetProgress(userID, courseID)
}
